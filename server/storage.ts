import { 
  Employee, 
  InsertEmployee, 
  EmployeeFilter, 
  FilterOptions,
  employees
} from "@shared/schema";
import sql from 'mssql';
// import { db } from './db';
// import { eq } from "drizzle-orm";

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

              -- Calculate Non-Billable Aging based on recent Non-Billable pattern
              CASE 
                  WHEN COUNT(ftl.UserName) = 0 OR MAX(ftl.Date) IS NULL THEN 'No timesheet filled'
                  -- Check if employee currently has Non-Billable entries in the last 30 days
                  WHEN SUM(CASE WHEN ftl.BillableStatus = 'Non-Billable' AND ftl.Date >= DATEADD(DAY, -30, GETDATE()) THEN 1 ELSE 0 END) > 0 THEN
                      CASE 
                          -- Calculate based on earliest recent Non-Billable entry (within last 6 months)
                          WHEN DATEDIFF(DAY, 
                              (SELECT MIN(Date) FROM RC_BI_Database.dbo.zoho_TimeLogs ftl2 
                               WHERE ftl2.UserName = a.ID 
                               AND ftl2.BillableStatus = 'Non-Billable'
                               AND ftl2.Date >= DATEADD(MONTH, -6, GETDATE())
                              ), GETDATE()) >= 91 THEN 'Non-Billable >90 days'
                          WHEN DATEDIFF(DAY, 
                              (SELECT MIN(Date) FROM RC_BI_Database.dbo.zoho_TimeLogs ftl2 
                               WHERE ftl2.UserName = a.ID 
                               AND ftl2.BillableStatus = 'Non-Billable'
                               AND ftl2.Date >= DATEADD(MONTH, -6, GETDATE())
                              ), GETDATE()) >= 61 THEN 'Non-Billable >60 days'
                          WHEN DATEDIFF(DAY, 
                              (SELECT MIN(Date) FROM RC_BI_Database.dbo.zoho_TimeLogs ftl2 
                               WHERE ftl2.UserName = a.ID 
                               AND ftl2.BillableStatus = 'Non-Billable'
                               AND ftl2.Date >= DATEADD(MONTH, -6, GETDATE())
                              ), GETDATE()) >= 31 THEN 'Non-Billable >30 days'
                          WHEN DATEDIFF(DAY, 
                              (SELECT MIN(Date) FROM RC_BI_Database.dbo.zoho_TimeLogs ftl2 
                               WHERE ftl2.UserName = a.ID 
                               AND ftl2.BillableStatus = 'Non-Billable'
                               AND ftl2.Date >= DATEADD(MONTH, -6, GETDATE())
                              ), GETDATE()) >= 11 THEN 'Non-Billable >10 days'
                          ELSE 'Non-Billable <=10 days'
                      END
                  -- Check if employee has older Non-Billable entries but no recent ones
                  WHEN SUM(CASE WHEN ftl.BillableStatus = 'Non-Billable' THEN 1 ELSE 0 END) > 0 THEN 'Non-Billable Mixed'
                  ELSE 'Not Non-Billable'
              END AS [NonBillableAging],

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
              CASE 
                WHEN CASE 
                  WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' 
                    OR [BillableStatus] IS NULL 
                    OR TRIM([BillableStatus]) = '' 
                  THEN 'No timesheet filled'
                  ELSE 'Non-Billable'
                END = 'No timesheet filled' THEN 'No timesheet filled'
                ELSE [NonBillableAging]
              END AS nonBillableAging
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
        console.log('🎯 NonBillableAging filter values:', filter.nonBillableAging);
        
        // Create condition to match any of the selected aging categories
        // Note: The main query already filters to only Non-Billable employees
        const agingConditions = filter.nonBillableAging.map(aging => {
          const escapedAging = String(aging).replace(/'/g, "''");
          return `nonBillableAging LIKE '%${escapedAging}%'`;
        });
        
        const combinedCondition = `(${agingConditions.join(' OR ')})`;
        whereClause += ` AND ${combinedCondition}`;
        
        console.log('🎯 Applied nonBillableAging filter:', combinedCondition);
        
        // Add debugging to see what data exists
        console.log('🔍 Debug: Adding sample query to check nonBillableAging values...');
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

      // Debug: Check the final query and test nonBillableAging values
      if (filter?.nonBillableAging && filter.nonBillableAging.length > 0) {
        console.log('🔍 FINAL WHERE CLAUSE:', whereClause);
        console.log('🔍 Testing nonBillableAging values...');
        try {
          // Test what nonBillableAging values actually exist in our filtered data
          const debugResult = await pool.request().query(`
            ${query.replace('FROM FilteredData', 'FROM FilteredData')}
            ORDER BY id
            OFFSET 0 ROWS
            FETCH NEXT 10 ROWS ONLY
          `);
          console.log('🔍 Sample data from FilteredData:');
          debugResult.recordset.forEach((row: any, idx: number) => {
            console.log(`🔍 Row ${idx + 1}: billableStatus="${row.billableStatus}", nonBillableAging="${row.nonBillableAging}"`);
          });
          
          // Check distinct nonBillableAging values and their counts
          const distinctResult = await pool.request().query(`
            WITH FilteredDataDebug AS (${query.replace('SELECT', 'SELECT').split('FROM FilteredData')[0]} FROM FilteredData)
            SELECT nonBillableAging, COUNT(*) as count
            FROM FilteredDataDebug
            GROUP BY nonBillableAging
            ORDER BY count DESC
          `);
          console.log('🔍 All distinct nonBillableAging values and counts:');
          distinctResult.recordset.forEach((row: any) => {
            console.log(`🔍 "${row.nonBillableAging}" - ${row.count} records`);
          });
          
          // Check what values would match our filter
          const filterValue = filter.nonBillableAging[0];
          const matchingResult = await pool.request().query(`
            WITH FilteredDataDebug AS (${query.replace('SELECT', 'SELECT').split('FROM FilteredData')[0]} FROM FilteredData)
            SELECT COUNT(*) as matchCount
            FROM FilteredDataDebug
            WHERE nonBillableAging LIKE '%${filterValue.replace(/'/g, "''")}%'
          `);
          console.log(`🔍 Records that would match filter "${filterValue}": ${matchingResult.recordset[0].matchCount}`);
        } catch (testError) {
          console.log('🔍 Debug query error:', testError instanceof Error ? testError.message : String(testError));
        }
      }

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
      console.log('📊 Getting filter options using employee data...');
      
      // Get employee data using the working query
      const employeeData = await this.getEmployees({ page: 1, pageSize: 1000 });
      const employees = employeeData.data;
      
      console.log(`📊 Using ${employees.length} employees to generate filter options`);

      // Extract unique values from employee data
      const departmentSet = new Set<string>();
      const billableStatusSet = new Set<string>();
      const businessUnitSet = new Set<string>();
      const clientSet = new Set<string>();
      const projectSet = new Set<string>();
      const timesheetAgingSet = new Set<string>();
      const locationSet = new Set<string>();

      employees.forEach(emp => {
        if (emp.department && emp.department.trim() && !emp.department.includes('No Department')) {
          departmentSet.add(emp.department);
        }
        if (emp.billableStatus && emp.billableStatus.trim()) {
          billableStatusSet.add(emp.billableStatus);
        }
        if (emp.businessUnit && emp.businessUnit.trim() && !emp.businessUnit.includes('No Business Unit')) {
          businessUnitSet.add(emp.businessUnit);
        }
        if (emp.client && emp.client.trim() && !emp.client.includes('No Client')) {
          clientSet.add(emp.client);
        }
        if (emp.project && emp.project.trim() && !emp.project.includes('No Project')) {
          projectSet.add(emp.project);
        }
        if (emp.timesheetAging && emp.timesheetAging.trim()) {
          timesheetAgingSet.add(emp.timesheetAging);
        }
        if (emp.location && emp.location.trim()) {
          locationSet.add(emp.location);
        }
      });

      const filterOptions: FilterOptions = {
        departments: Array.from(departmentSet).sort(),
        billableStatuses: Array.from(billableStatusSet).sort(),
        businessUnits: Array.from(businessUnitSet).sort(),
        clients: Array.from(clientSet).sort(),
        projects: Array.from(projectSet).sort(),
        timesheetAgings: Array.from(timesheetAgingSet).sort(),
        locations: Array.from(locationSet).sort(),
        nonBillableAgings: [
          'Non-Billable >10 days', 
          'Non-Billable >30 days',
          'Non-Billable >60 days',
          'Non-Billable >90 days',
          'No timesheet filled'
        ]
      };

      console.log(`📊 Filter options generated: ${filterOptions.departments.length} depts, ${filterOptions.clients.length} clients, ${filterOptions.projects.length} projects, ${filterOptions.locations.length} locations`);

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
        nonBillableAgings: [
          'Non-Billable >10 days', 
          'Non-Billable >30 days',
          'Non-Billable >60 days',
          'Non-Billable >90 days',
          'No timesheet filled'
        ]
      };
    }
  }
}

// PostgreSQL implementation removed - only using Azure SQL Server

export const storage = new AzureSqlStorage();

export async function debugClientNames() {
  try {
    console.log('\n🔍 DEBUGGING CLIENT NAMES...\n');
    
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
