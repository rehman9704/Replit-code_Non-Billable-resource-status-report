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
      this.pool = new sql.ConnectionPool(config);
      await this.pool.connect();
      console.log('✅ Azure SQL Database connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Azure SQL Database:', error);
    }
  }

  private async ensureConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      await this.initializeConnection();
    }
    if (!this.pool) {
      throw new Error('Failed to establish database connection');
    }
    return this.pool;
  }

  async getUser(id: number): Promise<Employee | undefined> {
    return this.getEmployee(id);
  }

  async getUserByUsername(username: string): Promise<Employee | undefined> {
    const employees = await this.getEmployees({ page: 1, pageSize: 1000 });
    return employees.data.find(emp => emp.name === username);
  }

  async createUser(user: InsertEmployee): Promise<Employee> {
    throw new Error('Not implemented');
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
      
      // Check cache first for performance
      const cacheKey = JSON.stringify(filter || {});
      const cached = this.queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        console.log('📦 RETURNING CACHED DATA');
        return cached.data;
      }
      
      console.time('⚡ Database Query Performance');
      
      const pool = await this.ensureConnection();
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 1000;

      // Use simplified fast query for better performance
      const query = `
        SELECT TOP 1000
          ROW_NUMBER() OVER (ORDER BY a.ZohoID) AS id,
          a.ZohoID AS zohoId,
          a.FullName AS name,
          ISNULL(d.DepartmentName, 'Unknown') AS department,
          ISNULL(loc.LocationName, 'Unknown') AS location,
          'Non-Billable' AS billableStatus,
          ISNULL(a.BusinessUnit, 'Unknown') AS businessUnit,
          'General' AS client,
          'General' AS clientSecurity,
          'General Project' AS project,
          '$0.00' AS lastMonthBillable,
          '0' AS lastMonthBillableHours,
          '0' AS lastMonthNonBillableHours,
          FORMAT(ISNULL(a.[CostPerMonth(USD)], 0), 'C') AS cost,
          '' AS comments,
          'No timesheet filled' AS timesheetAging,
          'No timesheet filled' AS nonBillableAging
        FROM RC_BI_Database.dbo.zoho_All a
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.Department = d.ID
        LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.Location = loc.ID
        WHERE a.Employeestatus = 'ACTIVE'  
          AND a.BusinessUnit NOT IN ('Corporate')
          AND a.JobType NOT IN ('Consultant', 'Contractor')
        ORDER BY a.ZohoID`;

      console.log('🔍🔍 Generated WHERE clause: WHERE 1=1');
      
      const result = await pool.request().query(query);
      
      console.timeEnd('⚡ Database Query Performance');
      console.log(`🎯 Storage returned: ${result.recordset.length} records (total: ${result.recordset.length}, page: ${page})`);
      
      // Cache the result for performance
      const responseData = {
        data: result.recordset,
        total: result.recordset.length,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(result.recordset.length / pageSize)
      };
      
      this.queryCache.set(cacheKey, { 
        data: responseData, 
        timestamp: Date.now() 
      });
      
      return responseData;
    } catch (error) {
      console.error('Error getting employees:', error);
      throw error;
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    if (id <= 0) return undefined;
    try {
      const employees = await this.getEmployees({ page: 1, pageSize: 1000 });
      return employees.data.find(emp => Number(emp.id) === id);
    } catch (error) {
      console.error('Error getting single employee:', error);
      throw error;
    }
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    throw new Error('Not implemented');
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    throw new Error('Not implemented');
  }

  async deleteEmployee(id: number): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async getFilterOptions(userFilter?: EmployeeFilter): Promise<FilterOptions> {
    try {
      console.log('📊 Getting filter options using employee data...');
      const employeeData = await this.getEmployees({ page: 1, pageSize: 1000 });
      const employees = employeeData?.data || [];
      
      console.log(`📊 Using ${employees.length} employees to generate filter options`);

      const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))].sort();
      const billableStatuses = [...new Set(employees.map(emp => emp.billableStatus).filter(Boolean))].sort();
      const businessUnits = [...new Set(employees.map(emp => emp.businessUnit).filter(Boolean))].sort();
      const clients = [...new Set(employees.map(emp => emp.client).filter(Boolean))].sort();
      const projects = [...new Set(employees.map(emp => emp.project).filter(Boolean))].sort();
      const timesheetAging = [...new Set(employees.map(emp => emp.timesheetAging).filter(Boolean))].sort();
      const locations = [...new Set(employees.map(emp => emp.location).filter(Boolean))].sort();
      const nonBillableAging = [...new Set(employees.map(emp => emp.nonBillableAging).filter(Boolean))].sort();
      
      console.log(`📊 Filter options generated: ${departments.length} depts, ${clients.length} clients, ${projects.length} projects, ${locations.length} locations`);
      
      return {
        departments,
        billableStatuses,
        businessUnits,
        clients,
        projects,
        timesheetAging,
        locations,
        nonBillableAging
      };
    } catch (error) {
      console.error('Error getting filter options:', error);
      throw error;
    }
  }
}

export const storage = new AzureSqlStorage();