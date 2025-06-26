import { 
  Employee, 
  InsertEmployee, 
  EmployeeFilter, 
  FilterOptions,
  employees
} from "@shared/schema";
import sql from 'mssql';

const config: sql.config = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

export interface IStorage {
  getUser(id: number): Promise<Employee | undefined>;
  getUserByUsername(username: string): Promise<Employee | undefined>;
  createUser(user: InsertEmployee): Promise<Employee>;
  
  getEmployees(filter?: EmployeeFilter): Promise<{
    data: Employee[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number
  }>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;
  getFilterOptions(userFilter?: EmployeeFilter): Promise<FilterOptions>;
}

export class AzureSqlStorage implements IStorage {
  private pool: sql.ConnectionPool | null = null;
  private queryCache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTimeout = 60 * 1000; // 60 seconds cache

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      console.log('Attempting to connect to Azure SQL Database...');
      this.pool = await sql.connect(config);
      console.log('✓ Connected to Azure SQL Database successfully');
      
      const result = await this.pool.request().query('SELECT COUNT(*) as count FROM RC_BI_Database.dbo.zoho_Employee');
      console.log(`✓ Found ${result.recordset[0].count} employees in database`);
    } catch (error) {
      console.error('✗ Failed to connect to Azure SQL Database:', error);
      console.error('Falling back to sample data');
    }
  }

  private async ensureConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      this.pool = await sql.connect(config);
    }
    return this.pool;
  }

  async getUser(id: number): Promise<Employee | undefined> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM employees WHERE id = @id');
      
      return result.recordset[0] || undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<Employee | undefined> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('username', sql.VarChar, username)
        .query('SELECT * FROM employees WHERE name = @username');
      
      return result.recordset[0] || undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(user: InsertEmployee): Promise<Employee> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('name', sql.VarChar, user.name)
        .input('zohoId', sql.VarChar, user.zohoId)
        .input('department', sql.VarChar, user.department)
        .input('businessUnit', sql.VarChar, user.businessUnit)
        .input('client', sql.VarChar, user.client)
        .input('project', sql.VarChar, user.project)
        .input('lastMonthBillable', sql.VarChar, user.lastMonthBillable)
        .input('lastMonthBillableHours', sql.VarChar, user.lastMonthBillableHours)
        .input('lastMonthNonBillableHours', sql.VarChar, user.lastMonthNonBillableHours)
        .input('cost', sql.VarChar, user.cost)
        .input('comments', sql.VarChar, user.comments || null)
        .input('timesheetAging', sql.VarChar, user.timesheetAging)
        .query(`
          INSERT INTO employees (name, zohoId, department, businessUnit, client, project, lastMonthBillable, lastMonthBillableHours, lastMonthNonBillableHours, cost, comments, timesheetAging)
          OUTPUT INSERTED.*
          VALUES (@name, @zohoId, @department, @businessUnit, @client, @project, @lastMonthBillable, @lastMonthBillableHours, @lastMonthNonBillableHours, @cost, @comments, @timesheetAging)
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getEmployees(filter?: EmployeeFilter): Promise<{
    data: Employee[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number
  }> {
    try {
      console.log(`🔥🔥🔥 STORAGE getEmployees called with filter:`, JSON.stringify(filter, null, 2));
      
      // Simple performance optimization - reduce logging for better speed
      console.time('⚡ Database Query Performance');
      
      const pool = await this.ensureConnection();
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 1000;
      const offset = (page - 1) * pageSize;

      const query = `
        WITH MergedData AS (
          SELECT 
              a.ZohoID AS [Employee Number],
              a.FullName AS [Employee Name],
              a.JobType AS [Job Type],
              a.Worklocation AS [Location],
              a.[CostPerMonth(USD)] AS [Cost (USD)],
              d.DepartmentName AS [Department Name],
              a.BusinessUnit AS [Business Unit],
              
              -- Picking only one client per employee
              MIN(cl_new.ClientName) AS [Client Name_Security],

              -- Merge Project Names
              STRING_AGG(
                  CASE 
                      WHEN ftl.Date IS NULL OR DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 
                      THEN '' 
                      ELSE COALESCE(pr_new.ProjectName, 'No Project') 
                  END, ' | '
              ) AS [Project Name], 

              -- Merge Client Names
              STRING_AGG(
                  CASE 
                      WHEN ftl.Date IS NULL OR DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 
                      THEN '' 
                      ELSE COALESCE(cl_new.ClientName, 'No Client') 
                  END, ' | '
              ) AS [Client Name],

              -- Merge Billable Status
              STRING_AGG(
                  CASE 
                      WHEN ftl.Date IS NULL THEN 'No timesheet filled'  
                      WHEN DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 THEN 'No timesheet filled'  
                      ELSE COALESCE(ftl.BillableStatus, 'Billable')  
                  END, ' | '
              ) AS [BillableStatus],

              -- Calculate Non-Billable Aging Days using aggregate function
              STRING_AGG(
                  CASE 
                      WHEN ftl.BillableStatus = 'Non-Billable' THEN
                          CASE 
                              WHEN DATEDIFF(DAY, ftl.Date, GETDATE()) <= 30 THEN 'Non-Billable >10 days'
                              WHEN DATEDIFF(DAY, ftl.Date, GETDATE()) <= 60 THEN 'Non-Billable >30 days'
                              WHEN DATEDIFF(DAY, ftl.Date, GETDATE()) <= 90 THEN 'Non-Billable >60 days'
                              ELSE 'Non-Billable >90 days'
                          END
                      WHEN ftl.Date IS NULL OR LOWER(COALESCE(ftl.BillableStatus, '')) LIKE '%no timesheet filled%' 
                        OR ftl.BillableStatus IS NULL OR TRIM(ftl.BillableStatus) = '' THEN 'No timesheet filled'
                      ELSE 'Not Non-Billable'
                  END, ' | '
              ) AS [NonBillableAging],

              -- Sum Logged Hours
              SUM(COALESCE(ftl.total_hours, 0)) AS [Total Logged Hours],

              -- Latest Timesheet Date
              MAX(CAST(ftl.Date AS DATE)) AS [Last updated timesheet date],

              -- Last month logged Billable hours
              COALESCE(bh.LastMonthBillableHours, 0) AS [Last month logged Billable hours],

              -- Last month logged Non Billable hours
              COALESCE(nb.LastMonthNonBillableHours, 0) AS [Last month logged Non Billable hours]

          FROM RC_BI_Database.dbo.zoho_Employee a

          LEFT JOIN (
              SELECT UserName, MAX(BillableStatus) AS BillableStatus  
              FROM RC_BI_Database.dbo.zoho_TimeLogs
              GROUP BY UserName
          ) tlc ON a.ID = tlc.UserName 

          LEFT JOIN (
              SELECT ztl.UserName, ztl.JobName, ztl.Project, ztl.Date, ztl.BillableStatus,  
                     SUM(TRY_CONVERT(FLOAT, ztl.hours)) AS total_hours  
              FROM RC_BI_Database.dbo.zoho_TimeLogs ztl
              INNER JOIN (
                  SELECT UserName, MAX(Date) AS LastLoggedDate  
                  FROM RC_BI_Database.dbo.zoho_TimeLogs
                  GROUP BY UserName
              ) lt ON ztl.UserName = lt.UserName AND ztl.Date = lt.LastLoggedDate
              WHERE TRY_CONVERT(FLOAT, ztl.hours) IS NOT NULL  
              GROUP BY ztl.UserName, ztl.JobName, ztl.Project, ztl.Date, ztl.BillableStatus
          ) ftl ON a.ID = ftl.UserName 

          -- Summing up Billable hours for the last month
          LEFT JOIN (
              SELECT UserName, 
                     SUM(TRY_CONVERT(FLOAT, Hours)) AS LastMonthBillableHours
              FROM RC_BI_Database.dbo.zoho_TimeLogs
              WHERE BillableStatus = 'Billable'
              AND Date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) - 1, 0)
              AND Date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
              GROUP BY UserName
          ) bh ON a.ID = bh.UserName

          -- Summing up Non-Billable hours for the last month
          LEFT JOIN (
              SELECT UserName, 
                     SUM(TRY_CONVERT(FLOAT, Hours)) AS LastMonthNonBillableHours
              FROM RC_BI_Database.dbo.zoho_TimeLogs
              WHERE BillableStatus = 'Non-Billable'
              AND Date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) - 1, 0)
              AND Date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
              GROUP BY UserName
          ) nb ON a.ID = nb.UserName

          LEFT JOIN (
              SELECT ProjectName, BillingType, EmployeeID, Status, ClientName, ProjectHead
              FROM (
                  SELECT zp.ProjectName, zp.BillingType, SplitValues.EmployeeID, zp.Status, zp.ClientName, zp.ProjectHead,
                         ROW_NUMBER() OVER (PARTITION BY SplitValues.EmployeeID ORDER BY zp.ProjectName) AS rn
                  FROM RC_BI_Database.dbo.zoho_Projects zp
                  CROSS APPLY (
                      SELECT value AS EmployeeID
                      FROM OPENJSON(CONCAT('["', REPLACE(zp.ProjectUsers, '::$$::', '","'), '"]'))
                  ) SplitValues
              ) x WHERE rn = 1
          ) p ON a.ID = p.EmployeeID 

          LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.Department = d.ID
          LEFT JOIN RC_BI_Database.dbo.zoho_Projects pr_new ON ftl.Project = pr_new.ID 
          LEFT JOIN RC_BI_Database.dbo.zoho_Clients cl_new ON pr_new.ClientName = cl_new.ID 

          WHERE 
              a.Employeestatus = 'ACTIVE'  
              AND a.BusinessUnit NOT IN ('Corporate')
              AND cl_new.ClientName NOT IN ('Digital Transformation', 'Corporate', 'Emerging Technologies')
              AND d.DepartmentName NOT IN ('Account Management - DC','Inside Sales - DC')
              AND (
                  (ftl.Date IS NULL)
                  OR (ftl.BillableStatus = 'Non-Billable')
                  OR (ftl.BillableStatus = 'No timesheet filled')
                  OR (DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 AND ftl.BillableStatus != 'Non-Billable')
              )
              AND a.JobType NOT IN ('Consultant', 'Contractor')
          
          GROUP BY 
              a.ZohoID, a.FullName, a.JobType, a.Worklocation, d.DepartmentName, 
              bh.LastMonthBillableHours, nb.LastMonthNonBillableHours, a.[CostPerMonth(USD)], a.BusinessUnit
        ),
        FilteredData AS (
          SELECT 
              ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
              [Employee Number] AS zohoId,
              [Employee Name] AS name,
              [Department Name] AS department,
              [Location] AS location,
              CASE 
                WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' 
                  OR [BillableStatus] IS NULL 
                  OR TRIM([BillableStatus]) = '' 
                THEN 'No timesheet filled'
                ELSE 'Non-Billable'
              END AS billableStatus,
              [Business Unit] AS businessUnit,
              [Client Name] AS client,
              [Client Name_Security] AS clientSecurity,
              [Project Name] AS project,
              FORMAT(ISNULL([Last month logged Billable hours], 0) * 50, 'C') AS lastMonthBillable,
              CAST(ISNULL([Last month logged Billable hours], 0) AS VARCHAR) AS lastMonthBillableHours,
              CAST(ISNULL([Last month logged Non Billable hours], 0) AS VARCHAR) AS lastMonthNonBillableHours,
              FORMAT(ISNULL([Cost (USD)], 0), 'C') AS cost,
              '' AS comments,
              CASE 
                WHEN CASE 
                  WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' 
                    OR [BillableStatus] IS NULL 
                    OR TRIM([BillableStatus]) = '' 
                  THEN 'No timesheet filled'
                  ELSE 'Non-Billable'
                END = 'No timesheet filled' THEN
                  CASE 
                    WHEN [Last updated timesheet date] IS NULL THEN 'No timesheet filled >90 days'
                    WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 91 THEN 'No timesheet filled >90 days'
                    WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 61 THEN 'No timesheet filled >60 days'
                    WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 31 THEN 'No timesheet filled >30 days'
                    WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 11 THEN 'No timesheet filled >10 days'
                    ELSE 'No timesheet filled <=10 days'
                  END
                ELSE 'Non-Billable'
              END AS timesheetAging,
              [NonBillableAging] AS nonBillableAging
          FROM MergedData
        )

        SELECT 
            id,
            zohoId,
            name,
            department,
            location,
            billableStatus,
            nonBillableAging,
            businessUnit,
            client,
            clientSecurity,
            project,
            lastMonthBillable,
            lastMonthBillableHours,
            lastMonthNonBillableHours,
            cost,
            comments,
            timesheetAging
        FROM FilteredData`;

      let whereClause = 'WHERE 1=1';
      const request = pool.request();
      
      // Apply filters
      if (filter?.department && filter.department.length > 0) {
        const deptList = filter.department.map(d => `'${String(d).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND department IN (${deptList})`;
      }
      if (filter?.billableStatus && filter.billableStatus.length > 0) {
        const statusList = filter.billableStatus.map(s => `'${String(s).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND billableStatus IN (${statusList})`;
      }
      if (filter?.businessUnit && filter.businessUnit.length > 0) {
        const buList = filter.businessUnit.map(bu => `'${String(bu).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND businessUnit IN (${buList})`;
      }
      if (filter?.client && filter.client.length > 0) {
        const clientList = filter.client.map(c => `'${String(c).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND client IN (${clientList})`;
      }
      if (filter?.project && filter.project.length > 0) {
        const projectList = filter.project.map(p => `'${String(p).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND project IN (${projectList})`;
      }
      if (filter?.timesheetAging && filter.timesheetAging.length > 0) {
        const agingList = filter.timesheetAging.map(a => `'${String(a).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND timesheetAging IN (${agingList})`;
      }
      if (filter?.location && filter.location.length > 0) {
        const locationList = filter.location.map(l => `'${String(l).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND location IN (${locationList})`;
      }
      if (filter?.nonBillableAging && filter.nonBillableAging.length > 0) {
        const nonBillableAgingList = filter.nonBillableAging.map(nba => `'${String(nba).replace(/'/g, "''")}'`).join(',');
        
        // Check if the filter includes actual Non-Billable aging brackets (not "No timesheet filled")
        const hasNonBillableAgingBrackets = filter.nonBillableAging.some(item => 
          item.includes('Non-Billable >') && !item.includes('No timesheet filled')
        );
        
        if (hasNonBillableAgingBrackets) {
          // Only show employees with Non-Billable status when filtering by Non-Billable aging brackets
          whereClause += ` AND nonBillableAging IN (${nonBillableAgingList}) AND billableStatus LIKE '%Non-Billable%'`;
        } else {
          // For "No timesheet filled" filter, show only those employees
          whereClause += ` AND nonBillableAging IN (${nonBillableAgingList})`;
        }
      }
      if (filter?.search) {
        whereClause += ' AND (name LIKE @search OR zohoId LIKE @search OR department LIKE @search OR billableStatus LIKE @search OR client LIKE @search OR project LIKE @search)';
        request.input('search', sql.VarChar, `%${filter.search}%`);
      }
      
      // Department-based access filtering
      if (filter?.allowedDepartments && filter.allowedDepartments.length > 0) {
        const departmentList = filter.allowedDepartments.map(d => `'${String(d).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND department IN (${departmentList})`;
        console.log(`🏢 Applied department-based filter: department IN (${departmentList})`);
      }

      // Business unit-based access filtering
      if (filter?.allowedBusinessUnits && filter.allowedBusinessUnits.length > 0) {
        const businessUnitList = filter.allowedBusinessUnits.map(bu => `'${String(bu).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND businessUnit IN (${businessUnitList})`;
        console.log(`🏢 Applied business unit-based filter: businessUnit IN (${businessUnitList})`);
      }

      // Client-based access filtering using clientSecurity field
      if (filter?.allowedClients && filter.allowedClients.length > 0) {
        // Check for special "NO_ACCESS_GRANTED" flag
        if (filter.allowedClients.includes('NO_ACCESS_GRANTED')) {
          whereClause += ` AND 1=0`; // This ensures no results are returned
          console.log(`🚫 Access denied - applied NO_ACCESS filter`);
        } else {
          const clientSecurityList = filter.allowedClients.map(c => `'${String(c).replace(/'/g, "''")}'`).join(',');
          whereClause += ` AND clientSecurity IN (${clientSecurityList})`;
          console.log(`🔐 Applied client-based filter: clientSecurity IN (${clientSecurityList})`);
        }
      }

      console.log(`🔍🔍 Generated WHERE clause: ${whereClause}`);
      
      request.input('offset', sql.Int, offset);
      request.input('pageSize', sql.Int, pageSize);

      const countResult = await request.query(`
        ${query.replace('FROM FilteredData', `FROM FilteredData ${whereClause}`)}
      `);
      const total = countResult.recordset.length;

      const dataResult = await request.query(`
        ${query.replace('FROM FilteredData', `FROM FilteredData ${whereClause}`)}
        ORDER BY id
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

      // Removed debug query to prevent connection issues

      const totalPages = Math.ceil(total / pageSize);

      console.timeEnd('⚡ Database Query Performance');
      console.log(`🎯 Storage returned: ${dataResult.recordset.length} records (total: ${total}, page: ${page})`);
      
      // Minimal debug logging for location data verification only
      if (dataResult.recordset.length > 0 && dataResult.recordset.length <= 5) {
        console.log('🏢 Location sample:', dataResult.recordset.map((row: any) => `${row.name}: ${row.location}`).join(', '));
      }

      return {
        data: dataResult.recordset.map((row: any) => ({
          id: row.id.toString(),
          zohoId: row.zohoId,
          name: row.name,
          department: row.department,
          location: row.location || '',
          billableStatus: row.billableStatus,
          businessUnit: row.businessUnit,
          client: row.client || '',
          clientSecurity: row.clientSecurity || '',
          project: row.project || '',
          lastMonthBillable: row.lastMonthBillable || '$0.00',
          lastMonthBillableHours: row.lastMonthBillableHours || '0',
          lastMonthNonBillableHours: row.lastMonthNonBillableHours || '0',
          cost: row.cost || '$0.00',
          comments: row.comments || '',
          timesheetAging: row.timesheetAging || '0-30',
          nonBillableAging: row.nonBillableAging || 'Not Non-Billable',
        })),
        total,
        page,
        pageSize,
        totalPages
      };
    } catch (error) {
      console.error('Error getting employees:', error);
      return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    return undefined;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    throw new Error('Not implemented');
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    return undefined;
  }

  async deleteEmployee(id: number): Promise<boolean> {
    return false;
  }

  async getFilterOptions(userFilter?: EmployeeFilter): Promise<FilterOptions> {
    try {
      const pool = await this.ensureConnection();
      
      // Use the same base query as getEmployees with user security filtering
      const query = `
        WITH MergedData AS (
          SELECT 
            ROW_NUMBER() OVER (ORDER BY a.ID) as id,
            a.ZohoID as zohoId,
            a.FullName as name,
            d.DepartmentName as department,
            CASE 
              WHEN ftl.TotalBillableHours > 0 THEN 'Billable'
              WHEN ftl.TotalNonBillableHours > 0 THEN 'Non-Billable'
              ELSE 'No timesheet filled'
            END AS billableStatus,
            a.BusinessUnit as businessUnit,
            ISNULL(cl_new.ClientName, 'No Client Assigned') as client,
            ISNULL(cl_new.ClientName, 'No Client Assigned') as clientSecurity,
            ISNULL(pr_new.ProjectName, 'No Project Assigned') as project,
            CONCAT('$', FORMAT(ISNULL(ftl.TotalBillableAmount, 0), 'N2')) as lastMonthBillable,
            CAST(ISNULL(ftl.TotalBillableHours, 0) AS INT) as lastMonthBillableHours,
            CAST(ISNULL(ftl.TotalNonBillableHours, 0) AS INT) as lastMonthNonBillableHours,
            CONCAT('$', FORMAT(ISNULL(a.Cost, 0), 'N2')) as cost,
            a.Comments as comments,
            ftl.[Last updated timesheet date]
          FROM RC_BI_Database.dbo.zoho_Employee a
          LEFT JOIN RC_BI_Database.dbo.zoho_TimeLogs ftl ON a.ID = ftl.UserName
          LEFT JOIN RC_BI_Database.dbo.zoho_Projects pr_new ON ftl.Project = pr_new.ID 
          LEFT JOIN RC_BI_Database.dbo.zoho_Clients cl_new ON pr_new.ClientName = cl_new.ID 
          LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.Department = d.ID
          WHERE a.Employeestatus = 'ACTIVE' 
            AND a.BusinessUnit NOT IN ('Corporate')
            AND cl_new.ClientName NOT IN ('Digital Transformation', 'Corporate', 'Emerging Technologies')
            AND d.DepartmentName NOT IN ('Account Management - DC','Inside Sales - DC')
            AND a.JobType NOT IN ('Consultant', 'Contractor')
        ),
        FilteredData AS (
          SELECT 
            *,
            CASE 
              WHEN billableStatus != 'No timesheet filled' THEN billableStatus
              ELSE 
                CASE 
                  WHEN [Last updated timesheet date] IS NULL THEN 'No timesheet filled >90 days'
                  WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 91 THEN 'No timesheet filled >90 days'
                  WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 61 THEN 'No timesheet filled >60 days'
                  WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 31 THEN 'No timesheet filled >30 days'
                  WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) >= 11 THEN 'No timesheet filled >10 days'
                  ELSE 'No timesheet filled <=10 days'
                END
            END AS timesheetAging
          FROM MergedData
        )
        
        SELECT DISTINCT department as value, 'department' as type FROM FilteredData
        WHERE department IS NOT NULL
        UNION ALL
        SELECT DISTINCT billableStatus as value, 'billableStatus' as type FROM FilteredData
        WHERE billableStatus IS NOT NULL
        UNION ALL
        SELECT DISTINCT businessUnit as value, 'businessUnit' as type FROM FilteredData
        WHERE businessUnit IS NOT NULL
        UNION ALL
        SELECT DISTINCT client as value, 'client' as type FROM FilteredData
        WHERE client IS NOT NULL AND client != 'No Client Assigned'
        UNION ALL
        SELECT DISTINCT project as value, 'project' as type FROM FilteredData
        WHERE project IS NOT NULL AND project != 'No Project Assigned'
        UNION ALL
        SELECT DISTINCT timesheetAging as value, 'timesheetAging' as type FROM FilteredData
        WHERE timesheetAging IS NOT NULL
        UNION ALL
        SELECT DISTINCT location as value, 'location' as type FROM FilteredData
        WHERE location IS NOT NULL
      `;

      // Apply the same security filtering as in getEmployees
      let whereClause = 'WHERE 1=1';
      const request = pool.request();
      
      // Department-based access filtering
      if (userFilter?.allowedDepartments && userFilter.allowedDepartments.length > 0) {
        const departmentList = userFilter.allowedDepartments.map(d => `'${String(d).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND department IN (${departmentList})`;
        console.log(`🏢 Applied department-based filter to options: department IN (${departmentList})`);
      }

      // Client-based access filtering using clientSecurity field
      if (userFilter?.allowedClients && userFilter.allowedClients.length > 0) {
        // Check for special "NO_ACCESS_GRANTED" flag
        if (userFilter.allowedClients.includes('NO_ACCESS_GRANTED')) {
          whereClause += ` AND 1=0`; // This ensures no results are returned
          console.log(`🚫 Access denied - applied NO_ACCESS filter to options`);
        } else {
          const clientSecurityList = userFilter.allowedClients.map(c => `'${String(c).replace(/'/g, "''")}'`).join(',');
          whereClause += ` AND clientSecurity IN (${clientSecurityList})`;
          console.log(`🔐 Applied client-based filter to options: clientSecurity IN (${clientSecurityList})`);
        }
      }

      console.log(`🔍 Filter options WHERE clause: ${whereClause}`);

      // Replace the WHERE clause in each UNION section
      const finalQuery = query.replace(/FROM FilteredData/g, `FROM FilteredData ${whereClause}`);
      
      const result = await request.query(finalQuery);

      const filterOptions: FilterOptions = {
        departments: [],
        billableStatuses: [],
        businessUnits: [],
        clients: [],
        projects: [],
        timesheetAgings: [],
        locations: [],
        nonBillableAgings: []
      };

      result.recordset.forEach((row: any) => {
        const value = row.value?.trim();
        if (value) {
          switch (row.type) {
            case 'department':
              filterOptions.departments.push(value);
              break;
            case 'billableStatus':
              filterOptions.billableStatuses.push(value);
              break;
            case 'businessUnit':
              filterOptions.businessUnits.push(value);
              break;
            case 'client':
              filterOptions.clients.push(value);
              break;
            case 'project':
              filterOptions.projects.push(value);
              break;
            case 'timesheetAging':
              filterOptions.timesheetAgings.push(value);
              break;
            case 'location':
              filterOptions.locations.push(value);
              break;
            case 'nonBillableAging':
              filterOptions.nonBillableAgings.push(value);
              break;
          }
        }
      });

      // Add predefined Non-Billable Aging values
      filterOptions.nonBillableAgings = [
        'Non-Billable <=10 days',
        'Non-Billable >10 days', 
        'Non-Billable >30 days',
        'Non-Billable >60 days',
        'Non-Billable >90 days'
      ];

      // Sort all arrays for consistent ordering
      filterOptions.departments.sort();
      filterOptions.billableStatuses.sort();
      filterOptions.businessUnits.sort();
      filterOptions.clients.sort();
      filterOptions.projects.sort();
      filterOptions.timesheetAgings.sort();

      console.log(`📊 Filter options returned: ${filterOptions.clients.length} clients, ${filterOptions.projects.length} projects, ${filterOptions.departments.length} departments`);

      return filterOptions;
    } catch (error) {
      console.error('Error getting filter options:', error);
      return {
        departments: [],
        billableStatuses: [],
        businessUnits: [],
        clients: [],
        projects: [],
        timesheetAgings: [],
        locations: [],
        nonBillableAgings: []
      };
    }
  }
}

// Import PostgreSQL Drizzle connection
import { db } from './db';
import { eq, and, or, like, sql as drizzleSql, count, desc, asc, inArray } from 'drizzle-orm';

// PostgreSQL Drizzle Storage Implementation
export class PostgreSqlStorage implements IStorage {
  
  async getUser(id: number): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<Employee | undefined> {
    // For now, return undefined since we don't have username in employees table
    return undefined;
  }

  async createUser(user: InsertEmployee): Promise<Employee> {
    const [created] = await db.insert(employees).values(user).returning();
    return created;
  }

  async getEmployees(filter?: EmployeeFilter): Promise<{
    data: Employee[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number
  }> {
    console.log('🔥🔥🔥 PostgreSQL getEmployees called with filter:', JSON.stringify(filter, null, 2));

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 50;
    const offset = (page - 1) * pageSize;
    
    // Build where conditions
    const conditions = [];

    if (filter?.department && filter.department.length > 0) {
      conditions.push(inArray(employees.department, filter.department));
    }

    if (filter?.billableStatus && filter.billableStatus.length > 0) {
      conditions.push(inArray(employees.billableStatus, filter.billableStatus));
    }

    if (filter?.businessUnit && filter.businessUnit.length > 0) {
      conditions.push(inArray(employees.businessUnit, filter.businessUnit));
    }

    if (filter?.client && filter.client.length > 0) {
      conditions.push(inArray(employees.client, filter.client));
    }

    if (filter?.project && filter.project.length > 0) {
      conditions.push(inArray(employees.project, filter.project));
    }

    if (filter?.location && filter.location.length > 0) {
      conditions.push(inArray(employees.location, filter.location));
    }

    if (filter?.timesheetAging && filter.timesheetAging.length > 0) {
      conditions.push(inArray(employees.timesheetAging, filter.timesheetAging));
    }

    if (filter?.search) {
      const searchTerm = `%${filter.search}%`;
      conditions.push(
        or(
          like(employees.name, searchTerm),
          like(employees.zohoId, searchTerm),
          like(employees.department, searchTerm),
          like(employees.billableStatus, searchTerm),
          like(employees.client, searchTerm),
          like(employees.project, searchTerm)
        )
      );
    }

    // Handle Non-Billable Aging filter - for now, just map to billableStatus
    if (filter?.nonBillableAging && filter.nonBillableAging.length > 0) {
      const hasNonBillableAgingBrackets = filter.nonBillableAging.some(item => 
        item.includes('Non-Billable >') && !item.includes('No timesheet filled')
      );
      
      if (hasNonBillableAgingBrackets) {
        // Only show employees with Non-Billable status
        conditions.push(like(employees.billableStatus, '%Non-Billable%'));
      } else if (filter.nonBillableAging.includes('No timesheet filled')) {
        // Show employees with 'No timesheet filled' status
        conditions.push(like(employees.billableStatus, '%No timesheet filled%'));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(employees)
      .where(whereClause);

    // Get paginated data
    const data = await db
      .select()
      .from(employees)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(filter?.sortOrder === 'desc' ? desc(employees.name) : asc(employees.name));

    const totalPages = Math.ceil(totalCount / pageSize);

    console.log(`🎯 PostgreSQL returned: ${data.length} records (total: ${totalCount}, page: ${page})`);

    return {
      data,
      total: totalCount,
      page,
      pageSize,
      totalPages
    };
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return result[0];
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [created] = await db.insert(employees).values(employee).returning();
    return created;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [updated] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getFilterOptions(userFilter?: EmployeeFilter): Promise<FilterOptions> {
    try {
      console.log('📊 Getting PostgreSQL filter options...');

      // Get distinct values for each filter
      const data = await db.select().from(employees);

      // Create unique arrays manually to avoid TypeScript issues
      const departmentSet = new Set<string>();
      const billableStatusSet = new Set<string>();
      const businessUnitSet = new Set<string>();
      const clientSet = new Set<string>();
      const projectSet = new Set<string>();
      const timesheetAgingSet = new Set<string>();
      const locationSet = new Set<string>();

      data.forEach(emp => {
        if (emp.department) departmentSet.add(emp.department);
        if (emp.billableStatus) billableStatusSet.add(emp.billableStatus);
        if (emp.businessUnit) businessUnitSet.add(emp.businessUnit);
        if (emp.client) clientSet.add(emp.client);
        if (emp.project) projectSet.add(emp.project);
        if (emp.timesheetAging) timesheetAgingSet.add(emp.timesheetAging);
        if (emp.location) locationSet.add(emp.location);
      });

      const filterOptions: FilterOptions = {
        departments: Array.from(departmentSet),
        billableStatuses: Array.from(billableStatusSet),
        businessUnits: Array.from(businessUnitSet),
        clients: Array.from(clientSet),
        projects: Array.from(projectSet),
        timesheetAgings: Array.from(timesheetAgingSet),
        locations: Array.from(locationSet),
        nonBillableAgings: [
          'Non-Billable <=10 days',
          'Non-Billable >10 days', 
          'Non-Billable >30 days',
          'Non-Billable >60 days',
          'Non-Billable >90 days',
          'No timesheet filled'
        ]
      };

      // Sort all arrays for consistent ordering
      filterOptions.departments.sort();
      filterOptions.billableStatuses.sort();
      filterOptions.businessUnits.sort();
      filterOptions.clients.sort();
      filterOptions.projects.sort();
      filterOptions.timesheetAgings.sort();
      filterOptions.locations.sort();

      console.log(`📊 PostgreSQL filter options: ${filterOptions.clients.length} clients, ${filterOptions.projects.length} projects`);

      return filterOptions;
    } catch (error) {
      console.error('Error getting PostgreSQL filter options:', error);
      return {
        departments: [],
        billableStatuses: [],
        businessUnits: [],
        clients: [],
        projects: [],
        timesheetAgings: [],
        locations: [],
        nonBillableAgings: []
      };
    }
  }
}

export const storage = new PostgreSqlStorage();

// Debug function to check client names
export async function debugClientNames() {
  try {
    // Get sample employees to examine client data structure
    const sampleEmployees = await storage.getEmployees({ page: 1, pageSize: 10 });
    
    console.log('🔍 SAMPLE EMPLOYEE CLIENT DATA:');
    sampleEmployees.data.slice(0, 10).forEach(emp => {
      console.log(`Employee: ${emp.name} | Client: "${emp.client}"`);
    });
    
    // Get filter options to see available clients
    const filterOptions = await storage.getFilterOptions();
    
    console.log('\n🔍 AVAILABLE CLIENT NAMES FROM FILTER OPTIONS:');
    filterOptions.clients.forEach((client: string) => {
      console.log(`"${client}"`);
    });
    
  } catch (error) {
    console.error('Debug client names error:', error);
  }
}