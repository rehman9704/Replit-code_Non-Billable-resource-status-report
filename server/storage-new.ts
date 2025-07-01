import * as sql from 'mssql';
import { Employee, InsertEmployee, EmployeeFilter, FilterOptions } from '../shared/schema';

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

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      const config: sql.config = {
        connectionString: process.env.DATABASE_URL,
        options: {
          trustServerCertificate: true,
          enableArithAbort: true,
        },
      };
      
      this.pool = new sql.ConnectionPool(config);
      await this.pool.connect();
      console.log('✅ Connected to Azure SQL Database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
    }
  }

  private async ensureConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      await this.initializeConnection();
    }
    return this.pool!;
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
      console.time('⚡ Fast Query Performance');
      
      const pool = await this.ensureConnection();
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 100;
      const offset = (page - 1) * pageSize;

      const query = `
        SELECT TOP ${pageSize}
            ROW_NUMBER() OVER (ORDER BY a.ZohoID) AS id,
            a.ZohoID AS zohoId,
            a.FullName AS name,
            ISNULL(d.DepartmentName, 'Unknown') AS department,
            ISNULL(loc.LocationName, 'Unknown') AS location,
            'Active' AS billableStatus,
            ISNULL(a.BusinessUnit, 'Unknown') AS businessUnit,
            ISNULL(a.Project, 'Unknown') AS client,
            ISNULL(a.Project, 'Unknown') AS clientSecurity,
            ISNULL(a.Project, 'Unknown') AS project,
            '$0.00' AS lastMonthBillable,
            '0' AS lastMonthBillableHours,
            '0' AS lastMonthNonBillableHours,
            '$0.00' AS cost,
            '' AS comments,
            'No timesheet filled' AS nonBillableAging,
            'No timesheet filled' AS timesheetAging
        FROM RC_BI_Database.dbo.zoho_Employee a
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.DepartmentID = d.ID
        LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.LocationID = loc.ID
        WHERE a.Employeestatus = 'ACTIVE'  
          AND a.BusinessUnit NOT IN ('Corporate')
          AND a.JobType NOT IN ('Consultant', 'Contractor')
        ORDER BY a.ZohoID`;

      console.log('🔧 Fast query ready to execute');
      
      const result = await pool.request().query(query);
      const employees = result.recordset || [];
      
      console.log(`📊 Query returned ${employees.length} employees`);
      console.timeEnd('⚡ Fast Query Performance');
      
      return {
        data: employees,
        total: employees.length,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(employees.length / pageSize)
      };
    } catch (error) {
      console.error('Error getting employees:', error);
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 100,
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
        .input('businessUnit', sql.VarChar, employee.businessUnit)
        .input('client', sql.VarChar, employee.client)
        .input('project', sql.VarChar, employee.project)
        .input('lastMonthBillable', sql.VarChar, employee.lastMonthBillable)
        .input('lastMonthBillableHours', sql.VarChar, employee.lastMonthBillableHours)
        .input('lastMonthNonBillableHours', sql.VarChar, employee.lastMonthNonBillableHours)
        .input('cost', sql.VarChar, employee.cost)
        .input('comments', sql.VarChar, employee.comments || null)
        .input('timesheetAging', sql.VarChar, employee.timesheetAging)
        .query(`
          INSERT INTO employees (name, zohoId, department, businessUnit, client, project, lastMonthBillable, lastMonthBillableHours, lastMonthNonBillableHours, cost, comments, timesheetAging)
          OUTPUT INSERTED.*
          VALUES (@name, @zohoId, @department, @businessUnit, @client, @project, @lastMonthBillable, @lastMonthBillableHours, @lastMonthNonBillableHours, @cost, @comments, @timesheetAging)
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
      const result = await pool.request()
        .input('id', sql.Int, id)
        .input('name', sql.VarChar, employee.name || null)
        .input('zohoId', sql.VarChar, employee.zohoId || null)
        .input('department', sql.VarChar, employee.department || null)
        .input('businessUnit', sql.VarChar, employee.businessUnit || null)
        .input('client', sql.VarChar, employee.client || null)
        .input('project', sql.VarChar, employee.project || null)
        .input('lastMonthBillable', sql.VarChar, employee.lastMonthBillable || null)
        .input('lastMonthBillableHours', sql.VarChar, employee.lastMonthBillableHours || null)
        .input('lastMonthNonBillableHours', sql.VarChar, employee.lastMonthNonBillableHours || null)
        .input('cost', sql.VarChar, employee.cost || null)
        .input('comments', sql.VarChar, employee.comments || null)
        .input('timesheetAging', sql.VarChar, employee.timesheetAging || null)
        .query(`
          UPDATE employees SET 
            name = COALESCE(@name, name),
            zohoId = COALESCE(@zohoId, zohoId),
            department = COALESCE(@department, department),
            businessUnit = COALESCE(@businessUnit, businessUnit),
            client = COALESCE(@client, client),
            project = COALESCE(@project, project),
            lastMonthBillable = COALESCE(@lastMonthBillable, lastMonthBillable),
            lastMonthBillableHours = COALESCE(@lastMonthBillableHours, lastMonthBillableHours),
            lastMonthNonBillableHours = COALESCE(@lastMonthNonBillableHours, lastMonthNonBillableHours),
            cost = COALESCE(@cost, cost),
            comments = COALESCE(@comments, comments),
            timesheetAging = COALESCE(@timesheetAging, timesheetAging)
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

  async getFilterOptions(userFilter?: EmployeeFilter): Promise<FilterOptions> {
    try {
      const pool = await this.ensureConnection();
      
      const query = `
        SELECT DISTINCT
            d.DepartmentName as department,
            'Active' as billableStatus,
            a.BusinessUnit as businessUnit,
            a.Project as client,
            a.Project as project,
            'No timesheet filled' as timesheetAging,
            loc.LocationName as location,
            'No timesheet filled' as nonBillableAging
        FROM RC_BI_Database.dbo.zoho_Employee a
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.DepartmentID = d.ID
        LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.LocationID = loc.ID
        WHERE a.Employeestatus = 'ACTIVE'  
          AND a.BusinessUnit NOT IN ('Corporate')
          AND a.JobType NOT IN ('Consultant', 'Contractor')`;
      
      const result = await pool.request().query(query);
      const employees = result.recordset || [];

      const filterOptions: FilterOptions = {
        departments: [...new Set(employees.map(emp => emp.department).filter(Boolean))],
        billableStatuses: ['Active', 'No timesheet filled'],
        businessUnits: [...new Set(employees.map(emp => emp.businessUnit).filter(Boolean))],
        clients: [...new Set(employees.map(emp => emp.client).filter(Boolean))],
        projects: [...new Set(employees.map(emp => emp.project).filter(Boolean))],
        timesheetAgings: ['No timesheet filled'],
        locations: [...new Set(employees.map(emp => emp.location).filter(Boolean))],
        nonBillableAgings: ['No timesheet filled']
      };

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

export const storage = new AzureSqlStorage();