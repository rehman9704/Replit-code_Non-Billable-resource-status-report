import { 
  Employee, 
  InsertEmployee, 
  EmployeeFilter, 
  FilterOptions
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
  getFilterOptions(): Promise<FilterOptions>;
}

export class AzureSqlStorage implements IStorage {
  private pool: sql.ConnectionPool | null = null;

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
                  OR (DATEDIFF(DAY, ftl.Date, GETDATE()) > 10)
                  OR (ftl.BillableStatus = 'Non-Billable') 
                  OR (ftl.BillableStatus = 'No timesheet filled')
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
              END AS timesheetAging
          FROM MergedData
        )

        SELECT 
            id,
            zohoId,
            name,
            department,
            billableStatus,
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

      console.log(`🎯🎯🎯 Storage returned: { dataLength: ${dataResult.recordset.length}, total: ${total}, page: ${page} }`);

      // Debug: Show actual employee details for timesheet admin
      if (filter?.allowedClients && filter.allowedClients.includes('Aramark')) {
        console.log('🔍 DEBUG: Employees returned for Aramark:');
        dataResult.recordset.forEach((row: any) => {
          console.log(`  - ${row.zohoId}: ${row.name} (Client: ${row.clientSecurity})`);
        });
      }

      return {
        data: dataResult.recordset.map((row: any) => ({
          id: row.id.toString(),
          zohoId: row.zohoId,
          name: row.name,
          department: row.department,
          location: '',
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

  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const pool = await this.ensureConnection();
      
      const result = await pool.request().query(`
        SELECT DISTINCT department as value, 'department' as type FROM (
          SELECT DISTINCT d.DepartmentName as department
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
        ) dept
        UNION ALL
        SELECT DISTINCT 'No timesheet filled' as value, 'billableStatus' as type
        UNION ALL
        SELECT DISTINCT 'Non-Billable' as value, 'billableStatus' as type
        UNION ALL
        SELECT DISTINCT businessUnit as value, 'businessUnit' as type FROM (
          SELECT DISTINCT a.BusinessUnit as businessUnit
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
        ) bu
        UNION ALL
        SELECT DISTINCT client as value, 'client' as type FROM (
          SELECT DISTINCT cl_new.ClientName as client
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
            AND cl_new.ClientName IS NOT NULL
        ) clients
        UNION ALL
        SELECT DISTINCT project as value, 'project' as type FROM (
          SELECT DISTINCT pr_new.ProjectName as project
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
            AND pr_new.ProjectName IS NOT NULL
        ) projects
        UNION ALL
        SELECT 'No timesheet filled >10 days' as value, 'timesheetAging' as type
        UNION ALL
        SELECT 'No timesheet filled >30 days' as value, 'timesheetAging' as type
        UNION ALL
        SELECT 'No timesheet filled >60 days' as value, 'timesheetAging' as type
        UNION ALL
        SELECT 'No timesheet filled >90 days' as value, 'timesheetAging' as type
        UNION ALL
        SELECT 'Non-Billable' as value, 'timesheetAging' as type
      `);

      const filterOptions: FilterOptions = {
        departments: [],
        billableStatuses: [],
        businessUnits: [],
        clients: [],
        projects: [],
        timesheetAgings: []
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
          }
        }
      });

      return filterOptions;
    } catch (error) {
      console.error('Error getting filter options:', error);
      return {
        departments: [],
        billableStatuses: [],
        businessUnits: [],
        clients: [],
        projects: [],
        timesheetAgings: []
      };
    }
  }
}

export const storage = new AzureSqlStorage();

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