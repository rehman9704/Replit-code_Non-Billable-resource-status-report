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

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<Employee | undefined>;
  getUserByUsername(username: string): Promise<Employee | undefined>;
  createUser(user: InsertEmployee): Promise<Employee>;
  
  // Employee timesheet data methods
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

export class MemStorage implements IStorage {
  private users: Map<number, Employee>;
  private employees: Map<number, Employee>;
  currentId: number;
  currentEmployeeId: number;

  constructor() {
    this.users = new Map();
    this.employees = new Map();
    this.currentId = 1;
    this.currentEmployeeId = 1;
    this.seedEmployees();
  }

  async getUser(id: number): Promise<Employee | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<Employee | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.name === username,
    );
  }

  async createUser(insertUser: InsertEmployee): Promise<Employee> {
    const id = this.currentId++;
    const user: Employee = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Employee timesheet data methods
  async getEmployees(filter?: EmployeeFilter): Promise<{
    data: Employee[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number
  }> {
    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 10;
    
    let employees = Array.from(this.employees.values());
    
    // Apply filters
    if (filter) {
      if (filter.department && filter.department !== '') {
        employees = employees.filter(emp => emp.department === filter.department);
      }
      
      if (filter.billableStatus && filter.billableStatus !== '') {
        employees = employees.filter(emp => emp.billableStatus === filter.billableStatus);
      }
      
      if (filter.businessUnit && filter.businessUnit !== '') {
        employees = employees.filter(emp => emp.businessUnit === filter.businessUnit);
      }
      
      if (filter.client && filter.client !== '') {
        employees = employees.filter(emp => emp.client === filter.client);
      }
      
      if (filter.project && filter.project !== '') {
        employees = employees.filter(emp => emp.project === filter.project);
      }
      
      if (filter.timesheetAging && filter.timesheetAging !== '') {
        employees = employees.filter(emp => emp.timesheetAging === filter.timesheetAging);
      }
      
      // Search by name, zoho ID, or department
      if (filter.search && filter.search !== '') {
        const searchTerm = filter.search.toLowerCase();
        employees = employees.filter(emp => 
          emp.name.toLowerCase().includes(searchTerm) ||
          emp.zohoId.toLowerCase().includes(searchTerm) ||
          emp.department.toLowerCase().includes(searchTerm)
        );
      }
      
      // Apply sorting
      if (filter.sortBy) {
        const key = filter.sortBy as keyof Employee;
        const direction = filter.sortOrder === 'desc' ? -1 : 1;
        
        employees.sort((a, b) => {
          const aValue = a[key];
          const bValue = b[key];
          
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return (aValue - bValue) * direction;
          }
          
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue) * direction;
          }
          
          return 0;
        });
      }
    }
    
    const total = employees.length;
    const totalPages = Math.ceil(total / pageSize);
    
    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedEmployees = employees.slice(start, end);
    
    return {
      data: paginatedEmployees,
      total,
      page,
      pageSize,
      totalPages
    };
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const id = this.currentEmployeeId++;
    const newEmployee: Employee = { ...employee, id };
    this.employees.set(id, newEmployee);
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existingEmployee = this.employees.get(id);
    if (!existingEmployee) return undefined;
    
    const updatedEmployee: Employee = { ...existingEmployee, ...employee };
    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async deleteEmployee(id: number): Promise<boolean> {
    return this.employees.delete(id);
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const employees = Array.from(this.employees.values());
    
    // Extract unique values for each filter option
    const departments = Array.from(new Set(employees.map(emp => emp.department)));
    const billableStatuses = Array.from(new Set(employees.map(emp => emp.billableStatus)));
    const businessUnits = Array.from(new Set(employees.map(emp => emp.businessUnit)));
    const clients = Array.from(new Set(employees.map(emp => emp.client)));
    const projects = Array.from(new Set(employees.map(emp => emp.project)));
    const timesheetAgings = Array.from(new Set(employees.map(emp => emp.timesheetAging)));
    
    return {
      departments,
      billableStatuses,
      businessUnits,
      clients,
      projects,
      timesheetAgings,
    };
  }

  // Seed data for the application
  private seedEmployees() {
    const sampleEmployees: InsertEmployee[] = [
      {
        name: "John Smith",
        zohoId: "ZH001",
        department: "Engineering",
        status: "Active",
        businessUnit: "Americas",
        client: "Acme Corp",
        project: "Project Alpha",
        lastMonthBillable: 12500,
        lastMonthBillableHours: 160,
        lastMonthNonBillableHours: 8,
        cost: 9600,
        comments: "Training completed",
        timesheetAging: "0-30"
      },
      {
        name: "Sarah Johnson",
        zohoId: "ZH002",
        department: "Marketing",
        status: "Active",
        businessUnit: "EMEA",
        client: "Globex",
        project: "Project Beta",
        lastMonthBillable: 9800,
        lastMonthBillableHours: 140,
        lastMonthNonBillableHours: 16,
        cost: 7800,
        comments: "On vacation (Jul 15-22)",
        timesheetAging: "0-30"
      },
      {
        name: "Michael Chen",
        zohoId: "ZH003",
        department: "Finance",
        status: "Pending",
        businessUnit: "APAC",
        client: "Initech",
        project: "Project Gamma",
        lastMonthBillable: 11200,
        lastMonthBillableHours: 152,
        lastMonthNonBillableHours: 12,
        cost: 8500,
        comments: "Contract renewal in progress",
        timesheetAging: "31-60"
      },
      {
        name: "Emily Wilson",
        zohoId: "ZH004",
        department: "HR",
        status: "Inactive",
        businessUnit: "Americas",
        client: "Umbrella",
        project: "Project Delta",
        lastMonthBillable: 0,
        lastMonthBillableHours: 0,
        lastMonthNonBillableHours: 0,
        cost: 0,
        comments: "Leave of absence",
        timesheetAging: "90+"
      },
      {
        name: "David Rodriguez",
        zohoId: "ZH005",
        department: "Sales",
        status: "Active",
        businessUnit: "Americas",
        client: "Acme Corp",
        project: "Project Alpha",
        lastMonthBillable: 14200,
        lastMonthBillableHours: 168,
        lastMonthNonBillableHours: 4,
        cost: 10800,
        comments: "Exceeded quota by 15%",
        timesheetAging: "0-30"
      },
      {
        name: "Lisa Wang",
        zohoId: "ZH006",
        department: "Engineering",
        status: "Active",
        businessUnit: "APAC",
        client: "Globex",
        project: "Project Gamma",
        lastMonthBillable: 13500,
        lastMonthBillableHours: 165,
        lastMonthNonBillableHours: 5,
        cost: 10100,
        comments: "New team member onboarding",
        timesheetAging: "0-30"
      },
      {
        name: "Robert Taylor",
        zohoId: "ZH007",
        department: "Marketing",
        status: "Active",
        businessUnit: "EMEA",
        client: "Initech",
        project: "Project Beta",
        lastMonthBillable: 10200,
        lastMonthBillableHours: 145,
        lastMonthNonBillableHours: 12,
        cost: 8400,
        comments: "Campaign launch successful",
        timesheetAging: "0-30"
      },
      {
        name: "Jennifer Brown",
        zohoId: "ZH008",
        department: "Finance",
        status: "Active",
        businessUnit: "Americas",
        client: "Umbrella",
        project: "Project Alpha",
        lastMonthBillable: 11800,
        lastMonthBillableHours: 156,
        lastMonthNonBillableHours: 8,
        cost: 9200,
        comments: "Quarterly review complete",
        timesheetAging: "31-60"
      },
      {
        name: "Alex Patel",
        zohoId: "ZH009",
        department: "Engineering",
        status: "Pending",
        businessUnit: "APAC",
        client: "Acme Corp",
        project: "Project Delta",
        lastMonthBillable: 10800,
        lastMonthBillableHours: 150,
        lastMonthNonBillableHours: 14,
        cost: 8700,
        comments: "Security clearance in progress",
        timesheetAging: "61-90"
      },
      {
        name: "Olivia Martinez",
        zohoId: "ZH010",
        department: "Sales",
        status: "Active",
        businessUnit: "EMEA",
        client: "Globex",
        project: "Project Gamma",
        lastMonthBillable: 13200,
        lastMonthBillableHours: 164,
        lastMonthNonBillableHours: 6,
        cost: 9800,
        comments: "New client acquisition",
        timesheetAging: "0-30"
      },
      {
        name: "James Wilson",
        zohoId: "ZH011",
        department: "HR",
        status: "Active",
        businessUnit: "Americas",
        client: "Initech",
        project: "Project Beta",
        lastMonthBillable: 9600,
        lastMonthBillableHours: 138,
        lastMonthNonBillableHours: 18,
        cost: 7600,
        comments: "Employee wellness program",
        timesheetAging: "0-30"
      },
      {
        name: "Sophia Lee",
        zohoId: "ZH012",
        department: "Engineering",
        status: "Inactive",
        businessUnit: "APAC",
        client: "Umbrella",
        project: "Project Alpha",
        lastMonthBillable: 0,
        lastMonthBillableHours: 0,
        lastMonthNonBillableHours: 0,
        cost: 0,
        comments: "Maternity leave",
        timesheetAging: "90+"
      }
    ];

    sampleEmployees.forEach(emp => {
      this.employees.set(this.currentEmployeeId, { ...emp, id: this.currentEmployeeId });
      this.currentEmployeeId++;
    });
  }
}

// Azure SQL Database Storage Implementation
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
      
      // Test the connection with a simple query
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
        .input('status', sql.VarChar, user.status)
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
          INSERT INTO employees (name, zohoId, department, status, businessUnit, client, project, lastMonthBillable, lastMonthBillableHours, lastMonthNonBillableHours, cost, comments, timesheetAging)
          OUTPUT INSERTED.*
          VALUES (@name, @zohoId, @department, @status, @businessUnit, @client, @project, @lastMonthBillable, @lastMonthBillableHours, @lastMonthNonBillableHours, @cost, @comments, @timesheetAging)
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
              AND a.BusinessUnit = 'Digital Commerce'
              AND (cl_new.ClientName IS NULL OR cl_new.ClientName NOT IN ('Digital Transformation', 'Corporate', 'Emerging Technologies'))
              AND (d.DepartmentName IS NULL OR d.DepartmentName NOT IN ('Account Management - DC','Inside Sales - DC'))
              AND (
                  (ftl.BillableStatus = 'Non-Billable') 
                  OR (ftl.BillableStatus = 'No timesheet filled')
                  OR (ftl.BillableStatus IS NULL)
              )
              AND (a.JobType IS NULL OR a.JobType NOT IN ('Consultant', 'Contractor'))
          
          GROUP BY 
              a.ZohoID, a.FullName, a.JobType, a.Worklocation, d.DepartmentName, 
              bh.LastMonthBillableHours, nb.LastMonthNonBillableHours, a.[CostPerMonth(USD)]
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
              'Digital Commerce' AS businessUnit,
              [Client Name] AS client,
              [Project Name] AS project,
              FORMAT(ISNULL([Last month logged Billable hours], 0) * 50, 'C') AS lastMonthBillable,
              CAST(ISNULL([Last month logged Billable hours], 0) AS VARCHAR) AS lastMonthBillableHours,
              CAST(ISNULL([Last month logged Non Billable hours], 0) AS VARCHAR) AS lastMonthNonBillableHours,
              FORMAT(ISNULL([Cost (USD)], 0), 'C') AS cost,
              '' AS comments,
              CASE 
                WHEN [Last updated timesheet date] IS NULL THEN '90+'
                WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) BETWEEN 0 AND 30 THEN '0-30'
                WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) BETWEEN 31 AND 60 THEN '31-60'
                WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) BETWEEN 61 AND 90 THEN '61-90'
                ELSE '90+'
              END AS timesheetAging
          FROM MergedData
        )

        SELECT 
            ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
            [Employee Number] AS zohoId,
            [Employee Name] AS name,
            [Department Name] AS department,
            CASE 
              WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' THEN 'No timesheet filled'
              ELSE 'Non-Billable'
            END AS billableStatus,
            'Digital Commerce' AS businessUnit,
            [Client Name] AS client,
            [Project Name] AS project,
            FORMAT(ISNULL([Last month logged Billable hours], 0) * 50, 'C') AS lastMonthBillable,
            CAST(ISNULL([Last month logged Billable hours], 0) AS VARCHAR) AS lastMonthBillableHours,
            CAST(ISNULL([Last month logged Non Billable hours], 0) AS VARCHAR) AS lastMonthNonBillableHours,
            FORMAT(ISNULL([Cost (USD)], 0), 'C') AS cost,
            '' AS comments,
            CASE 
              WHEN [Last updated timesheet date] IS NULL THEN '90+'
              WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) BETWEEN 0 AND 30 THEN '0-30'
              WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) BETWEEN 31 AND 60 THEN '31-60'
              WHEN DATEDIFF(DAY, [Last updated timesheet date], GETDATE()) BETWEEN 61 AND 90 THEN '61-90'
              ELSE '90+'
            END AS timesheetAging
        FROM MergedData`;

      let whereClause = 'WHERE 1=1';
      const request = pool.request();

      if (filter?.department && filter.department !== 'all') {
        whereClause += ' AND department LIKE @department';
        request.input('department', sql.VarChar, `%${filter.department}%`);
      }
      if (filter?.billableStatus && filter.billableStatus !== 'all') {
        whereClause += ' AND billableStatus = @billableStatus';
        request.input('billableStatus', sql.VarChar, filter.billableStatus);
      }
      if (filter?.businessUnit && filter.businessUnit !== 'all') {
        whereClause += ' AND businessUnit = @businessUnit';
        request.input('businessUnit', sql.VarChar, filter.businessUnit);
      }
      if (filter?.client && filter.client !== 'all') {
        whereClause += ' AND client LIKE @client';
        request.input('client', sql.VarChar, `%${filter.client}%`);
      }
      if (filter?.project && filter.project !== 'all') {
        whereClause += ' AND project LIKE @project';
        request.input('project', sql.VarChar, `%${filter.project}%`);
      }
      if (filter?.timesheetAging && filter.timesheetAging !== 'all') {
        whereClause += ' AND timesheetAging = @timesheetAging';
        request.input('timesheetAging', sql.VarChar, filter.timesheetAging);
      }
      if (filter?.search) {
        whereClause += ' AND (name LIKE @search OR zohoId LIKE @search OR department LIKE @search OR billableStatus LIKE @search OR client LIKE @search OR project LIKE @search)';
        request.input('search', sql.VarChar, `%${filter.search}%`);
      }

      request.input('offset', sql.Int, offset);
      request.input('pageSize', sql.Int, pageSize);

      const countResult = await request.query(`
        WITH MergedData AS (
          SELECT 
              a.ZohoID AS [Employee Number],
              a.FullName AS [Employee Name],
              a.JobType AS [Job Type],
              a.Worklocation AS [Location],
              a.[CostPerMonth(USD)] AS [Cost (USD)],
              d.DepartmentName AS [Department Name],
              
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
              AND a.BusinessUnit = 'Digital Commerce'
              AND cl_new.ClientName NOT IN ('Digital Transformation', 'Corporate', 'Emerging Technologies')
              AND d.DepartmentName NOT IN ('Account Management - DC','Inside Sales - DC')
              AND (
                  (ftl.Date IS NULL) -- No timesheet logged (Bench)
                  OR (DATEDIFF(DAY, ftl.Date, GETDATE()) > 10) -- Last timesheet older than 10 days
                  OR (ftl.BillableStatus = 'Non-Billable') 
                  OR (ftl.BillableStatus = 'No timesheet filled') 
              )
              AND a.JobType NOT IN ('Consultant', 'Contractor')
          
          GROUP BY 
              a.ZohoID, a.FullName, a.JobType, a.Worklocation, d.DepartmentName, 
              bh.LastMonthBillableHours, nb.LastMonthNonBillableHours, a.[CostPerMonth(USD)]
        ),
        FilteredData AS (
          SELECT 
              ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
              [Employee Number] AS zohoId,
              [Employee Name] AS name,
              [Department Name] AS department,
              CASE 
                WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' THEN 'No timesheet filled'
                ELSE 'Non-Billable'
              END AS billableStatus,
              'Digital Commerce' AS businessUnit,
              [Client Name] AS client,
              [Project Name] AS project,
              FORMAT(ISNULL([Last month logged Billable hours], 0) * 50, 'C') AS lastMonthBillable,
              CAST(ISNULL([Last month logged Billable hours], 0) AS VARCHAR) AS lastMonthBillableHours,
              CAST(ISNULL([Last month logged Non Billable hours], 0) AS VARCHAR) AS lastMonthNonBillableHours,
              FORMAT(ISNULL([Cost (USD)], 0), 'C') AS cost,
              '' AS comments,
              CASE 
                WHEN CASE 
                  WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' THEN 'No timesheet filled'
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
        SELECT COUNT(*) as total FROM FilteredData ${whereClause}`);
      const total = countResult.recordset[0].total;

      const dataResult = await request.query(`
        WITH MergedData AS (
          SELECT 
              a.ZohoID AS [Employee Number],
              a.FullName AS [Employee Name],
              a.JobType AS [Job Type],
              a.Worklocation AS [Location],
              a.[CostPerMonth(USD)] AS [Cost (USD)],
              d.DepartmentName AS [Department Name],
              
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
              AND a.BusinessUnit = 'Digital Commerce'
              AND cl_new.ClientName NOT IN ('Digital Transformation', 'Corporate', 'Emerging Technologies')
              AND d.DepartmentName NOT IN ('Account Management - DC','Inside Sales - DC')
              AND (
                  (ftl.Date IS NULL) -- No timesheet logged (Bench)
                  OR (DATEDIFF(DAY, ftl.Date, GETDATE()) > 10) -- Last timesheet older than 10 days
                  OR (ftl.BillableStatus = 'Non-Billable') 
                  OR (ftl.BillableStatus = 'No timesheet filled') 
              )
              AND a.JobType NOT IN ('Consultant', 'Contractor')
          
          GROUP BY 
              a.ZohoID, a.FullName, a.JobType, a.Worklocation, d.DepartmentName, 
              bh.LastMonthBillableHours, nb.LastMonthNonBillableHours, a.[CostPerMonth(USD)]
        ),
        FilteredData AS (
          SELECT 
              ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
              [Employee Number] AS zohoId,
              [Employee Name] AS name,
              [Department Name] AS department,
              CASE 
                WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' THEN 'No timesheet filled'
                ELSE 'Non-Billable'
              END AS billableStatus,
              'Digital Commerce' AS businessUnit,
              [Client Name] AS client,
              [Project Name] AS project,
              FORMAT(ISNULL([Last month logged Billable hours], 0) * 50, 'C') AS lastMonthBillable,
              CAST(ISNULL([Last month logged Billable hours], 0) AS VARCHAR) AS lastMonthBillableHours,
              CAST(ISNULL([Last month logged Non Billable hours], 0) AS VARCHAR) AS lastMonthNonBillableHours,
              FORMAT(ISNULL([Cost (USD)], 0), 'C') AS cost,
              '' AS comments,
              CASE 
                WHEN CASE 
                  WHEN LOWER(COALESCE([BillableStatus], '')) LIKE '%no timesheet filled%' THEN 'No timesheet filled'
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
        SELECT * FROM FilteredData ${whereClause}
        ORDER BY id
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

      const totalPages = Math.ceil(total / pageSize);

      return {
        data: dataResult.recordset,
        total,
        page,
        pageSize,
        totalPages
      };
    } catch (error) {
      console.error('Error getting employees:', error);
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0
      };
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    return this.getUser(id);
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    return this.createUser(employee);
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    try {
      const pool = await this.ensureConnection();
      const request = pool.request().input('id', sql.Int, id);

      const updateFields: string[] = [];
      
      if (employee.name !== undefined) {
        updateFields.push('name = @name');
        request.input('name', sql.VarChar, employee.name);
      }
      if (employee.zohoId !== undefined) {
        updateFields.push('zohoId = @zohoId');
        request.input('zohoId', sql.VarChar, employee.zohoId);
      }
      if (employee.department !== undefined) {
        updateFields.push('department = @department');
        request.input('department', sql.VarChar, employee.department);
      }
      if (employee.status !== undefined) {
        updateFields.push('status = @status');
        request.input('status', sql.VarChar, employee.status);
      }
      if (employee.businessUnit !== undefined) {
        updateFields.push('businessUnit = @businessUnit');
        request.input('businessUnit', sql.VarChar, employee.businessUnit);
      }
      if (employee.client !== undefined) {
        updateFields.push('client = @client');
        request.input('client', sql.VarChar, employee.client);
      }
      if (employee.project !== undefined) {
        updateFields.push('project = @project');
        request.input('project', sql.VarChar, employee.project);
      }
      if (employee.lastMonthBillable !== undefined) {
        updateFields.push('lastMonthBillable = @lastMonthBillable');
        request.input('lastMonthBillable', sql.VarChar, employee.lastMonthBillable);
      }
      if (employee.lastMonthBillableHours !== undefined) {
        updateFields.push('lastMonthBillableHours = @lastMonthBillableHours');
        request.input('lastMonthBillableHours', sql.VarChar, employee.lastMonthBillableHours);
      }
      if (employee.lastMonthNonBillableHours !== undefined) {
        updateFields.push('lastMonthNonBillableHours = @lastMonthNonBillableHours');
        request.input('lastMonthNonBillableHours', sql.VarChar, employee.lastMonthNonBillableHours);
      }
      if (employee.cost !== undefined) {
        updateFields.push('cost = @cost');
        request.input('cost', sql.VarChar, employee.cost);
      }
      if (employee.comments !== undefined) {
        updateFields.push('comments = @comments');
        request.input('comments', sql.VarChar, employee.comments);
      }
      if (employee.timesheetAging !== undefined) {
        updateFields.push('timesheetAging = @timesheetAging');
        request.input('timesheetAging', sql.VarChar, employee.timesheetAging);
      }

      if (updateFields.length === 0) {
        return this.getEmployee(id);
      }

      const result = await request.query(`
        UPDATE employees 
        SET ${updateFields.join(', ')}
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

      return result.recordset[0] || undefined;
    } catch (error) {
      console.error('Error updating employee:', error);
      return undefined;
    }
  }

  async deleteEmployee(id: number): Promise<boolean> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM employees WHERE id = @id');

      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error deleting employee:', error);
      return false;
    }
  }

  async getFilterOptions(): Promise<FilterOptions> {
    try {
      // Get filter options by running the exact same query as the main employee data
      // This ensures filters only show data that actually exists in the 110 employee records
      const employeeData = await this.getEmployees({ page: 1, pageSize: 1000 });
      
      if (!employeeData.data || employeeData.data.length === 0) {
        return {
          departments: [],
          billableStatuses: [],
          businessUnits: [],
          clients: [],
          projects: [],
          timesheetAgings: []
        };
      }

      // Extract unique values from actual employee data
      const departmentSet = new Set(employeeData.data.map(emp => emp.department).filter(d => d && d.trim()));
      const billableStatusSet = new Set(employeeData.data.map(emp => emp.billableStatus).filter(s => s && s.trim()));
      const businessUnitSet = new Set(employeeData.data.map(emp => emp.businessUnit).filter(b => b && b.trim()));
      const clientSet = new Set(employeeData.data.map(emp => emp.client).filter(c => c && c.trim() && !c.includes('No Client')));
      const projectSet = new Set(employeeData.data.map(emp => emp.project).filter(p => p && p.trim() && !p.includes('No Project')));
      const timesheetAgingSet = new Set(employeeData.data.map(emp => emp.timesheetAging).filter(t => t && t.trim()));

      const departments = Array.from(departmentSet).sort();
      const billableStatuses = Array.from(billableStatusSet).sort();
      const businessUnits = Array.from(businessUnitSet).sort();
      const clients = Array.from(clientSet).sort();
      const projects = Array.from(projectSet).sort();
      const timesheetAgings = Array.from(timesheetAgingSet).sort();

      return {
        departments,
        billableStatuses,
        businessUnits,
        clients,
        projects,
        timesheetAgings
      };
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

// Use Azure SQL Database storage instead of in-memory storage
export const storage = new AzureSqlStorage();
