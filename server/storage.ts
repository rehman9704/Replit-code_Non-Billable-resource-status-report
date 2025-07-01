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
      console.log('✅ Connected to Azure SQL Database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      this.pool = null;
    }
  }

  private async ensureConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      await this.initializeConnection();
    }
    return this.pool!;
  }

  async getUser(id: number): Promise<Employee | undefined> {
    return undefined;
  }

  async getUserByUsername(username: string): Promise<Employee | undefined> {
    return undefined;
  }

  async createUser(user: InsertEmployee): Promise<Employee> {
    return {
      id: 1,
      ...user,
      comments: user.comments || null
    };
  }

  async getEmployees(filter?: EmployeeFilter): Promise<{
    data: Employee[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number
  }> {
    try {
      console.time('⚡ Optimized Query Performance');
      
      const pool = await this.ensureConnection();
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 100;
      const offset = (page - 1) * pageSize;

      // Use the simplified fast query without complex aging calculations
      const query = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY a.ZohoID) AS id,
            a.ZohoID AS zohoId,
            a.FullName AS name,
            ISNULL(d.DepartmentName, 'Unknown') AS department,
            ISNULL(loc.LocationName, 'Unknown') AS location,
            'Active' AS billableStatus,
            ISNULL(a.BusinessUnit, 'Unknown') AS businessUnit,
            ISNULL(a.Project, 'Unknown') AS client,
            ISNULL(a.Project, 'Unknown') AS project,
            '0.00' AS lastMonthBillable,
            '0' AS lastMonthBillableHours,
            '0' AS lastMonthNonBillableHours,
            '0.00' AS cost,
            '' AS comments,
            'No timesheet filled' AS timesheetAging
        FROM RC_BI_Database.dbo.zoho_Employee a
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.DepartmentID = d.ID
        LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.LocationID = loc.ID
        WHERE a.Employeestatus = 'ACTIVE'  
          AND a.BusinessUnit NOT IN ('Corporate')
          AND a.JobType NOT IN ('Consultant', 'Contractor')
        ORDER BY a.ZohoID
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY`;

      console.log('🔧 Executing fast query without complex aging calculations');
      
      const result = await pool.request().query(query);
      const employees = result.recordset || [];
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM RC_BI_Database.dbo.zoho_Employee a
        WHERE a.Employeestatus = 'ACTIVE'  
          AND a.BusinessUnit NOT IN ('Corporate')
          AND a.JobType NOT IN ('Consultant', 'Contractor')`;
      
      const countResult = await pool.request().query(countQuery);
      const total = countResult.recordset[0]?.total || 0;
      
      console.log(`📊 Query returned ${employees.length} employees out of ${total} total`);
      console.timeEnd('⚡ Optimized Query Performance');
      
      return {
        data: employees,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize)
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
    return undefined;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    return {
      id: 1,
      ...employee,
      comments: employee.comments || null
    };
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
      
      const query = `
        SELECT DISTINCT
            d.DepartmentName as department,
            'Active' as billableStatus,
            a.BusinessUnit as businessUnit,
            a.Project as client,
            a.Project as project,
            'No timesheet filled' as timesheetAging,
            loc.LocationName as location
        FROM RC_BI_Database.dbo.zoho_Employee a
        LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.DepartmentID = d.ID
        LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.LocationID = loc.ID
        WHERE a.Employeestatus = 'ACTIVE'  
          AND a.BusinessUnit NOT IN ('Corporate')
          AND a.JobType NOT IN ('Consultant', 'Contractor')`;
      
      const result = await pool.request().query(query);
      const employees = result.recordset || [];

      const filterOptions: FilterOptions = {
        departments: [...new Set(employees.map((emp: any) => emp.department).filter(Boolean))],
        billableStatuses: ['Active', 'No timesheet filled'],
        businessUnits: [...new Set(employees.map((emp: any) => emp.businessUnit).filter(Boolean))],
        clients: [...new Set(employees.map((emp: any) => emp.client).filter(Boolean))],
        projects: [...new Set(employees.map((emp: any) => emp.project).filter(Boolean))],
        timesheetAgings: ['No timesheet filled'],
        locations: [...new Set(employees.map((emp: any) => emp.location).filter(Boolean))],
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

export async function debugClientNames() {
  try {
    console.log('🔍 Debugging client names from database...');
    const storage = new AzureSqlStorage();
    
    // Use the ensureConnection method
    const pool = (storage as any).pool;
    if (!pool) {
      console.log('❌ No database connection available');
      return;
    }

    const query = `
      SELECT DISTINCT 
          a.Project as client_name,
          COUNT(*) as employee_count
      FROM RC_BI_Database.dbo.zoho_Employee a
      WHERE a.Employeestatus = 'ACTIVE'  
        AND a.BusinessUnit NOT IN ('Corporate')
        AND a.JobType NOT IN ('Consultant', 'Contractor')
        AND a.Project IS NOT NULL
        AND a.Project != ''
      GROUP BY a.Project
      ORDER BY employee_count DESC`;
    
    const result = await pool.request().query(query);
    
    console.log('📊 Client Names Analysis:');
    result.recordset.forEach((row: any) => {
      console.log(`   ${row.client_name}: ${row.employee_count} employees`);
    });
    
  } catch (error) {
    console.error('❌ Error in debugClientNames:', error);
  }
}