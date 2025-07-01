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
      console.time('⚡ Database Query Performance');
      
      const pool = await this.ensureConnection();
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 100;
      const offset = (page - 1) * pageSize;

      // First, let's check the actual column structure
      console.log('🔍 Checking database schema...');
      
      // Query that includes timesheet filtering to get the correct employee count (around 233)
      const query = `
        WITH EmployeeTimesheet AS (
          SELECT DISTINCT 
              e.ZohoID,
              e.FullName,
              e.Department,
              e.Location,
              e.BusinessUnit
          FROM RC_BI_Database.dbo.zoho_Employee e
          INNER JOIN RC_BI_Database.dbo.zoho_TimeLogs t ON e.ZohoID = t.EmployeeNumber
          WHERE e.Employeestatus = 'ACTIVE'  
            AND e.BusinessUnit NOT IN ('Corporate')
            AND e.JobType NOT IN ('Consultant', 'Contractor')
        )
        SELECT 
            ROW_NUMBER() OVER (ORDER BY ZohoID) AS id,
            ZohoID AS zohoId,
            FullName AS name,
            ISNULL(Department, 'Unknown') AS department,
            ISNULL(Location, 'Unknown') AS location,
            'Active' AS billableStatus,
            ISNULL(BusinessUnit, 'Unknown') AS businessUnit,
            ISNULL(BusinessUnit, 'Unknown') AS client,
            ISNULL(BusinessUnit, 'Unknown') AS project,
            '0.00' AS lastMonthBillable,
            '0' AS lastMonthBillableHours,
            '0' AS lastMonthNonBillableHours,
            '0.00' AS cost,
            '' AS comments,
            'No timesheet filled' AS timesheetAging
        FROM EmployeeTimesheet
        ORDER BY ZohoID
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY`;

      console.log('🔧 Executing query with timesheet join to get correct employee count');
      
      const result = await pool.request().query(query);
      const employees = result.recordset || [];
      
      // Get total count with same filtering approach
      const countQuery = `
        SELECT COUNT(DISTINCT e.ZohoID) as total
        FROM RC_BI_Database.dbo.zoho_Employee e
        INNER JOIN RC_BI_Database.dbo.zoho_TimeLogs t ON e.ZohoID = t.EmployeeNumber
        WHERE e.Employeestatus = 'ACTIVE'  
          AND e.BusinessUnit NOT IN ('Corporate')
          AND e.JobType NOT IN ('Consultant', 'Contractor')`;
      
      const countResult = await pool.request().query(countQuery);
      const total = countResult.recordset[0]?.total || 0;
      
      console.log(`📊 Query returned ${employees.length} employees out of ${total} total`);
      console.timeEnd('⚡ Database Query Performance');
      
      return {
        data: employees,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('Error getting employees:', error);
      
      // If that fails, let's try an even simpler query to check what columns exist
      try {
        console.log('🔍 Trying to identify available columns...');
        const pool = await this.ensureConnection();
        
        const schemaQuery = `
          SELECT TOP 1 * 
          FROM RC_BI_Database.dbo.zoho_Employee`;
        
        const schemaResult = await pool.request().query(schemaQuery);
        
        if (schemaResult.recordset && schemaResult.recordset.length > 0) {
          console.log('📋 Available columns:', Object.keys(schemaResult.recordset[0]));
        }
      } catch (schemaError) {
        console.error('Error checking schema:', schemaError);
      }
      
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
            Department as department,
            'Active' as billableStatus,
            BusinessUnit as businessUnit,
            BusinessUnit as client,
            BusinessUnit as project,
            'No timesheet filled' as timesheetAging,
            Location as location
        FROM RC_BI_Database.dbo.zoho_Employee
        WHERE Employeestatus = 'ACTIVE'  
          AND BusinessUnit NOT IN ('Corporate')
          AND JobType NOT IN ('Consultant', 'Contractor')`;
      
      const result = await pool.request().query(query);
      const employees = result.recordset || [];

      const filterOptions: FilterOptions = {
        departments: Array.from(new Set(employees.map((emp: any) => emp.department).filter(Boolean))),
        billableStatuses: ['Active', 'No timesheet filled'],
        businessUnits: Array.from(new Set(employees.map((emp: any) => emp.businessUnit).filter(Boolean))),
        clients: Array.from(new Set(employees.map((emp: any) => emp.client).filter(Boolean))),
        projects: Array.from(new Set(employees.map((emp: any) => emp.project).filter(Boolean))),
        timesheetAgings: ['No timesheet filled'],
        locations: Array.from(new Set(employees.map((emp: any) => emp.location).filter(Boolean))),
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