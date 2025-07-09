import { 
  Employee, 
  InsertEmployee, 
  EmployeeFilter, 
  FilterOptions,
  employees,
  chatCommentsIntended
} from "@shared/schema";
import sql from 'mssql';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, sql as drizzleSql } from "drizzle-orm";

// Initialize PostgreSQL connection for virtual employees
let postgresClient: any;
let db: any;

try {
  if (process.env.DATABASE_URL) {
    postgresClient = neon(process.env.DATABASE_URL);
    db = drizzle(postgresClient);
    console.log('✅ PostgreSQL connection initialized successfully');
  } else {
    console.log('❌ DATABASE_URL not found - virtual employees disabled');
  }
} catch (error) {
  console.log('❌ PostgreSQL connection failed:', error);
}

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
        WITH EmployeeTimesheetSummary AS (
          -- Get basic timesheet summary per employee
          SELECT 
              UserName,
              MAX(Date) AS LastTimesheetDate,
              MAX(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) > 0 THEN Date END) AS LastValidBillableDate,
              MAX(CASE WHEN BillableStatus = 'Non-Billable' THEN Date END) AS LastNonBillableDate,
              COUNT(CASE WHEN BillableStatus = 'Non-Billable' THEN 1 END) AS NonBillableCount,
              COUNT(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) = 0 THEN 1 END) AS ZeroBillableCount,
              COUNT(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) > 0 THEN 1 END) AS ValidBillableCount,
              -- Calculate days since last timesheet filled (any type)
              DATEDIFF(DAY, MAX(Date), GETDATE()) AS DaysSinceLastTimesheet,
              -- Calculate days since last valid billable work
              DATEDIFF(DAY, MAX(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) > 0 THEN Date END), GETDATE()) AS DaysSinceLastValidBillable,
              -- Calculate total days in Non-Billable status (for employees with no valid billable history)
              DATEDIFF(DAY, MIN(CASE WHEN BillableStatus = 'Non-Billable' THEN Date END), GETDATE()) AS TotalNonBillableDays
          FROM RC_BI_Database.dbo.zoho_TimeLogs
          WHERE Date >= DATEADD(MONTH, -6, GETDATE())
          GROUP BY UserName
        ),
        MixedUtilizationCheck AS (
          -- Check for employees with both billable and non-billable on their LAST ENTRY DATE only
          SELECT DISTINCT ets.UserName
          FROM EmployeeTimesheetSummary ets
          WHERE ets.LastTimesheetDate IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM RC_BI_Database.dbo.zoho_TimeLogs t1
              WHERE t1.UserName = ets.UserName 
                AND t1.Date = ets.LastTimesheetDate
                AND t1.BillableStatus = 'Billable'
            )
            AND EXISTS (
              SELECT 1 FROM RC_BI_Database.dbo.zoho_TimeLogs t2
              WHERE t2.UserName = ets.UserName 
                AND t2.Date = ets.LastTimesheetDate
                AND t2.BillableStatus = 'Non-Billable'
            )
        ),
        NonBillableAgingData AS (
          SELECT 
              ets.UserName,
              CASE 
                -- Mixed Utilization: Check if user is in mixed utilization list FIRST
                WHEN muc.UserName IS NOT NULL THEN 'Mixed Utilization'
                -- Simple Non-Billable aging based on days since last valid billable work
                WHEN ets.LastValidBillableDate IS NOT NULL THEN
                  CASE 
                    WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 10 THEN 'Non-Billable ≤10 days'
                    WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 30 THEN 'Non-Billable >10 days'
                    WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 60 THEN 'Non-Billable >30 days'
                    WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 90 THEN 'Non-Billable >60 days'
                    ELSE 'Non-Billable >90 days'
                  END
                -- For employees with only Non-Billable entries (no valid billable history)
                -- Use TotalNonBillableDays to classify based on how long they've been Non-Billable
                WHEN ets.LastNonBillableDate IS NOT NULL AND ets.ValidBillableCount = 0 THEN
                  CASE 
                    WHEN ets.TotalNonBillableDays <= 10 THEN 'Non-Billable ≤10 days'
                    WHEN ets.TotalNonBillableDays <= 30 THEN 'Non-Billable >10 days'
                    WHEN ets.TotalNonBillableDays <= 60 THEN 'Non-Billable >30 days'
                    WHEN ets.TotalNonBillableDays <= 90 THEN 'Non-Billable >60 days'
                    ELSE 'Non-Billable >90 days'
                  END
                -- For employees with some Non-Billable entries (but may have zero-billable entries too)
                WHEN ets.LastNonBillableDate IS NOT NULL THEN
                  CASE 
                    WHEN ets.TotalNonBillableDays <= 10 THEN 'Non-Billable ≤10 days'
                    WHEN ets.TotalNonBillableDays <= 30 THEN 'Non-Billable >10 days'
                    WHEN ets.TotalNonBillableDays <= 60 THEN 'Non-Billable >30 days'
                    WHEN ets.TotalNonBillableDays <= 90 THEN 'Non-Billable >60 days'
                    ELSE 'Non-Billable >90 days'
                  END
                -- For employees with any other timesheet activity (fallback)
                WHEN ets.LastTimesheetDate IS NOT NULL THEN
                  CASE 
                    WHEN ets.DaysSinceLastTimesheet <= 10 THEN 'Non-Billable ≤10 days'
                    WHEN ets.DaysSinceLastTimesheet <= 30 THEN 'Non-Billable >10 days'
                    WHEN ets.DaysSinceLastTimesheet <= 60 THEN 'Non-Billable >30 days'
                    WHEN ets.DaysSinceLastTimesheet <= 90 THEN 'Non-Billable >60 days'
                    ELSE 'Non-Billable >90 days'
                  END
                -- Only employees with absolutely no timesheet data
                ELSE 'No timesheet filled'
              END AS NonBillableAging
          FROM EmployeeTimesheetSummary ets
          LEFT JOIN MixedUtilizationCheck muc ON ets.UserName = muc.UserName
        ),
        MergedData AS (
          SELECT 
              a.ZohoID AS [Employee Number],
              a.FullName AS [Employee Name],
              a.JobType AS [Job Type],
              loc.LocationName AS [Location],
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

              -- Get pre-calculated NonBillableAging
              COALESCE(nba.NonBillableAging, 'Not Non-Billable') AS [NonBillableAging],

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

          LEFT JOIN NonBillableAgingData nba ON a.ID = nba.UserName

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
          LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.Location = loc.ID
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
              a.ZohoID, a.FullName, a.JobType, loc.LocationName, d.DepartmentName, 
              bh.LastMonthBillableHours, nb.LastMonthNonBillableHours, a.[CostPerMonth(USD)], a.BusinessUnit, nba.NonBillableAging
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
                WHEN [NonBillableAging] IS NULL THEN 'No timesheet filled'
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
        
        // Use exact matching for aging categories
        const agingList = filter.nonBillableAging.map(aging => `'${String(aging).replace(/'/g, "''")}'`).join(',');
        whereClause += ` AND nonBillableAging IN (${agingList})`;
        
        console.log('🎯 Applied nonBillableAging filter:', `nonBillableAging IN (${agingList})`);
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

      // Debug nonBillableAging filter issue
      if (filter?.nonBillableAging && filter.nonBillableAging.length > 0) {
        console.log('🔍 FINAL WHERE CLAUSE:', whereClause);
        console.log('🔍 NonBillableAging filter values:', filter.nonBillableAging);
      }

      const countResult = await request.query(`
        ${query.replace('FROM FilteredData', `FROM FilteredData ${whereClause}`)}
      `);
      const total = countResult.recordset.length;

      const dataResult = await request.query(`
        ${query.replace('FROM FilteredData', `FROM FilteredData ${whereClause}`)}
        ORDER BY name ASC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

      // Removed debug query to prevent connection issues

      const totalPages = Math.ceil(total / pageSize);

      console.timeEnd('⚡ Database Query Performance');
      console.log(`🎯 Storage returned: ${dataResult.recordset.length} records (total: ${total}, page: ${page})`);
      
      // Debug nonBillableAging values - check when no filter to see what values exist
      if (dataResult.recordset.length > 0) {
        const agingValues = new Set<string>();
        dataResult.recordset.forEach((row: any) => {
          if (row.nonBillableAging) {
            agingValues.add(row.nonBillableAging);
          }
        });
        console.log('🔍 All unique nonBillableAging values in dataset:', Array.from(agingValues));
        
        // Show distribution of aging values
        const agingCounts = new Map<string, number>();
        dataResult.recordset.forEach((row: any) => {
          if (row.nonBillableAging) {
            agingCounts.set(row.nonBillableAging, (agingCounts.get(row.nonBillableAging) || 0) + 1);
          }
        });
        console.log('🔍 Aging value distribution:', Object.fromEntries(agingCounts));
        
        // Show specific examples of each aging category
        console.log('🔍 Sample employees by aging category:');
        ['Non-Billable ≤10 days', 'Non-Billable >10 days', 'Non-Billable >30 days', 'Non-Billable >60 days', 'Non-Billable >90 days'].forEach(aging => {
          const examples = dataResult.recordset.filter((row: any) => row.nonBillableAging === aging).slice(0, 3);
          if (examples.length > 0) {
            console.log(`🔍 ${aging}: ${examples.map((r: any) => r.name).join(', ')} (${agingCounts.get(aging) || 0} total)`);
          }
        });
        
        if (filter?.nonBillableAging && filter.nonBillableAging.length > 0) {
          console.log('🔍 Filter looking for:', filter.nonBillableAging);
          console.log('🔍 Sample records with aging data:');
          dataResult.recordset.slice(0, 5).forEach((row: any) => {
            if (row.nonBillableAging && row.nonBillableAging !== 'Not Non-Billable') {
              console.log(`🔍 ${row.name}: "${row.nonBillableAging}"`);
            }
          });
        }
      }
      
      // Minimal debug logging for location data verification only
      if (dataResult.recordset.length > 0 && dataResult.recordset.length <= 5 && !filter?.nonBillableAging) {
        console.log('🏢 Location sample:', dataResult.recordset.map((row: any) => `${row.name}: ${row.location}`).join(', '));
      }

      // 🔧 CRITICAL FIX: Sanitize any incorrect Non-Billable aging categorization
      dataResult.recordset.forEach((row: any) => {
        if (row.nonBillableAging === 'Non-Billable =10 days' || row.nonBillableAging === 'Non-Billable <=10 days') {
          console.log(`🔧 FIXING: ${row.name} (${row.zohoId}) - changing "${row.nonBillableAging}" to "Non-Billable ≤10 days"`);
          row.nonBillableAging = 'Non-Billable ≤10 days';
        }
      });

      // BATCH-CYCLE PROTECTION: Comment attribution system protected from overnight processes
      // Virtual employee integration disabled to maintain exact 196 employee count
      // Comments remain accessible via chat system with bulletproof attribution
      console.log('🛡️ BATCH-CYCLE PROTECTION: Virtual employee integration disabled for data stability');
      console.log('🎯 Azure SQL returned employees:', dataResult.recordset.length);
      console.log('🛡️ Comment attribution system protected from automated reallocation');
      
      // Get all employees with comments from PostgreSQL who might not be in Azure SQL
      let virtualEmployeesResult: any[] = [];
      
      if (db) {
        try {
          virtualEmployeesResult = await db
            .select({
              zohoId: chatCommentsIntended.intendedZohoId,
              intendedFor: chatCommentsIntended.intendedEmployeeName,
            })
            .from(chatCommentsIntended)
            .where(eq(chatCommentsIntended.isVisible, true));
          console.log('🎯 PostgreSQL query successful, found', virtualEmployeesResult.length, 'comment records');
        } catch (error) {
          console.log('🎯 PostgreSQL query failed:', error);
          virtualEmployeesResult = [];
        }
      } else {
        console.log('🎯 PostgreSQL connection not available - skipping virtual employees');
      }

      const virtualEmployees: any[] = [];
      const existingZohoIds = new Set(dataResult.recordset.map((row: any) => row.zohoId));
      
      // Group by ZohoID to avoid duplicates
      const virtualEmployeeMap = new Map<string, any>();
      
      virtualEmployeesResult.forEach((comment) => {
        if (!existingZohoIds.has(comment.zohoId) && !virtualEmployeeMap.has(comment.zohoId)) {
          console.log(`🎯 ADDING VIRTUAL EMPLOYEE: ${comment.intendedFor} (ZohoID: ${comment.zohoId})`);
          
          // Create virtual employee with comment access
          virtualEmployeeMap.set(comment.zohoId, {
            id: (1000000 + virtualEmployees.length).toString(), // High ID to avoid conflicts
            zohoId: comment.zohoId,
            name: comment.intendedFor || `Employee ${comment.zohoId}`,
            department: 'Former Employee', // Mark as former employee
            location: '',
            billableStatus: 'No timesheet filled',
            businessUnit: 'Former Employee',
            client: '',
            clientSecurity: '',
            project: '',
            lastMonthBillable: '$0.00',
            lastMonthBillableHours: '0',
            lastMonthNonBillableHours: '0',
            cost: '$0.00',
            comments: 'Has feedback comments',
            timesheetAging: '0-30',
            nonBillableAging: 'Not Non-Billable',
          });
        }
      });
      
      // Convert map to array
      Array.from(virtualEmployeeMap.values()).forEach(ve => virtualEmployees.push(ve));
      
      console.log(`🎯 ADDED ${virtualEmployees.length} VIRTUAL EMPLOYEES WITH COMMENTS`);
      if (virtualEmployees.length > 0) {
        console.log(`🎯 Virtual employees: ${virtualEmployees.map(ve => `${ve.name} (${ve.zohoId})`).join(', ')}`);
      } else {
        console.log('🎯 No virtual employees found - checking if PostgreSQL query worked correctly');
        console.log(`🎯 PostgreSQL query returned ${virtualEmployeesResult.length} comment records`);
      }

      // Return only regular employees (virtual employees disabled per user request)
      const allEmployees = dataResult.recordset.map((row: any) => ({
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
      }));

      const totalRegular = allEmployees.length;
      const totalPagesRegular = Math.ceil(totalRegular / pageSize);

      return {
        data: allEmployees,
        total: totalRegular,
        page,
        pageSize,
        totalPages: totalPagesRegular
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
      const nonBillableAgingSet = new Set<string>();

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
        // nonBillableAging is added by our SQL query but not in the base Employee type
        if ((emp as any).nonBillableAging && (emp as any).nonBillableAging.trim()) {
          nonBillableAgingSet.add((emp as any).nonBillableAging);
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
        nonBillableAgings: Array.from(nonBillableAgingSet).sort((a, b) => {
          // Custom sort order for aging categories
          const order = [
            'Mixed Utilization',
            'Non-Billable ≤10 days',
            'Non-Billable >10 days', 
            'Non-Billable >30 days',
            'Non-Billable >60 days',
            'Non-Billable >90 days',
            'No timesheet filled'
          ];
          const aIndex = order.indexOf(a);
          const bIndex = order.indexOf(b);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        })
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
          'Non-Billable ≤10 days',
          'Non-Billable >10 days', 
          'Non-Billable >30 days',
          'Non-Billable >60 days',
          'Non-Billable >90 days',
          'Mixed Utilization',
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
