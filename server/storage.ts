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
    
    // Apply filters - updated to handle both single values and arrays
    if (filter) {
      // Helper function to check if a value matches filter criteria
      const matchesFilter = (value: string, filterValue: string | string[]) => {
        console.log(`🔍 Checking filter: value="${value}", filterValue=`, filterValue, `type=${typeof filterValue}`);
        if (!filterValue) return true;
        if (typeof filterValue === 'string') {
          const result = filterValue === '' || value === filterValue;
          console.log(`String match: "${value}" === "${filterValue}" = ${result}`);
          return result;
        }
        if (Array.isArray(filterValue)) {
          const result = filterValue.length === 0 || filterValue.includes(value);
          console.log(`Array match: filterValue.includes("${value}") = ${filterValue.includes(value)}, array=`, filterValue);
          return result;
        }
        return true;
      };

      if (filter.department) {
        employees = employees.filter(emp => matchesFilter(emp.department, filter.department));
      }
      
      if (filter.billableStatus) {
        employees = employees.filter(emp => matchesFilter(emp.billableStatus, filter.billableStatus));
      }
      
      if (filter.businessUnit) {
        employees = employees.filter(emp => matchesFilter(emp.businessUnit, filter.businessUnit));
      }
      
      if (filter.client) {
        employees = employees.filter(emp => matchesFilter(emp.client, filter.client));
      }
      
      if (filter.project) {
        employees = employees.filter(emp => matchesFilter(emp.project, filter.project));
      }
      
      if (filter.timesheetAging) {
        employees = employees.filter(emp => matchesFilter(emp.timesheetAging, filter.timesheetAging));
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
      console.log(`🔥🔥🔥 STORAGE getEmployees called with filter:`, JSON.stringify(filter, null, 2));
      
      const pool = await this.ensureConnection();
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 1000;
      const offset = (page - 1) * pageSize;

      // Query to get all Digital Commerce employees (targeting 251 employees)
      const employeeQuery = `
        SELECT 
          a.ZohoID as zohoId,
          a.FullName as name,
          COALESCE(d.DepartmentName, 'No Department') as department,
          'Active' as status,
          a.BusinessUnit as businessUnit,
          'Sample Client' as client,
          'Sample Client' as clientSecurity,
          'Sample Project' as project,
          a.Worklocation as location,
          '$0.00' as lastMonthBillable,
          '0' as lastMonthBillableHours,
          '0' as lastMonthNonBillableHours,
          FORMAT(ISNULL(a.[CostPerMonth(USD)], 0), 'C') as cost,
          '' as comments,
          '0-30' as timesheetAging,
          'Not Non-Billable' as nonBillableAging
        FROM RC_BI_Database.dbo.zoho_Employee a WITH (NOLOCK)
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d WITH (NOLOCK) ON a.Department = d.ID
        WHERE a.ZohoID IS NOT NULL 
          AND a.Employeestatus = 'ACTIVE'
          AND a.BusinessUnit = 'Digital Commerce'
        ORDER BY a.FullName
      `;

      // Use the employee query to get all Digital Commerce employees
      const result = await pool.request().query(employeeQuery);
      console.log(`🔥 Direct query returned ${result.recordset.length} records`);
      
      const employees = result.recordset.map((row: any, index: number) => ({
        id: index + 1,
        ...row
      }));

      return {
        data: employees,
        total: employees.length,
        page,
        pageSize,
        totalPages: Math.ceil(employees.length / pageSize)
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
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM employees WHERE id = @id');
      
      return result.recordset[0] || undefined;
    } catch (error) {
      console.error('Error getting employee:', error);
      return undefined;
    }
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('name', sql.VarChar, employee.name)
        .input('zohoId', sql.VarChar, employee.zohoId)
        .input('department', sql.VarChar, employee.department)
        .input('status', sql.VarChar, employee.status)
        .input('businessUnit', sql.VarChar, employee.businessUnit)
        .input('client', sql.VarChar, employee.client)
        .input('project', sql.VarChar, employee.project)
        .input('lastMonthBillable', sql.Int, employee.lastMonthBillable)
        .input('lastMonthBillableHours', sql.Int, employee.lastMonthBillableHours)
        .input('lastMonthNonBillableHours', sql.Int, employee.lastMonthNonBillableHours)
        .input('cost', sql.Int, employee.cost)
        .input('comments', sql.VarChar, employee.comments)
        .input('timesheetAging', sql.VarChar, employee.timesheetAging)
        .query(`
          INSERT INTO employees (name, zohoId, department, status, businessUnit, client, project, lastMonthBillable, lastMonthBillableHours, lastMonthNonBillableHours, cost, comments, timesheetAging)
          OUTPUT INSERTED.*
          VALUES (@name, @zohoId, @department, @status, @businessUnit, @client, @project, @lastMonthBillable, @lastMonthBillableHours, @lastMonthNonBillableHours, @cost, @comments, @timesheetAging)
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    try {
      const pool = await this.ensureConnection();
      const setClauses = [];
      const request = pool.request().input('id', sql.Int, id);

      if (employee.name !== undefined) {
        setClauses.push('name = @name');
        request.input('name', sql.VarChar, employee.name);
      }
      if (employee.zohoId !== undefined) {
        setClauses.push('zohoId = @zohoId');
        request.input('zohoId', sql.VarChar, employee.zohoId);
      }
      if (employee.department !== undefined) {
        setClauses.push('department = @department');
        request.input('department', sql.VarChar, employee.department);
      }

      if (setClauses.length === 0) {
        return this.getEmployee(id);
      }

      const result = await request.query(`
        UPDATE employees 
        SET ${setClauses.join(', ')}
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
      console.log('🔄 Getting filter options...');
      const pool = await this.ensureConnection();
      
      // Simple query to get basic filter data
      const result = await pool.request().query(`
        SELECT DISTINCT 
          COALESCE(d.DepartmentName, 'No Department') as department,
          'Active' as status,
          'Digital Commerce' as businessUnit,
          'Sample Client' as client,
          'Sample Project' as project,
          a.Worklocation as location
        FROM RC_BI_Database.dbo.zoho_Employee a WITH (NOLOCK)
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d WITH (NOLOCK) ON a.Department = d.ID
        WHERE a.ZohoID IS NOT NULL
      `);

      console.log(`📊 Using ${result.recordset.length} employees to generate filter options`);

      const departments = [...new Set(result.recordset.map(row => row.department).filter(Boolean))];
      const businessUnits = ['Digital Commerce'];
      const clients = ['Sample Client'];
      const projects = ['Sample Project'];
      const locations = [...new Set(result.recordset.map(row => row.location).filter(Boolean))];

      const filterOptions = {
        departments: departments.sort(),
        billableStatuses: ['Active', 'Non-Billable', 'No timesheet filled'],
        businessUnits: businessUnits.sort(),
        clients: clients.sort(),
        projects: projects.sort(),
        timesheetAgings: ['0-30', '31-60', '61-90', '90+'],
        locations: locations.sort(),
        nonBillableAgings: ['Not Non-Billable', 'Non-Billable ≤10 days', 'Non-Billable >10 days', 'Non-Billable >30 days', 'Non-Billable >60 days', 'Non-Billable >90 days', 'Mixed Utilization', 'No timesheet filled']
      };

      console.log(`📊 Filter options generated: ${departments.length} depts, ${clients.length} clients, ${projects.length} projects, ${locations.length} locations`);
      
      return filterOptions;
    } catch (error) {
      console.error('❌ Error getting filter options:', error);
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

export const storage = new AzureSqlStorage();
