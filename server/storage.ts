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
        SELECT TOP 100
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
        FilteredData AS (
          SELECT 
              ROW_NUMBER() OVER (ORDER BY EmployeeNumber) AS id,
              EmployeeNumber AS zohoId,
              EmployeeName AS name,
              Department AS department,
              Location AS location,
              BillableStatus AS billableStatus,
              BusinessUnit AS businessUnit,
              Client AS client,
              Client AS clientSecurity,
              Project AS project,
              '$0.00' AS lastMonthBillable,
              '0' AS lastMonthBillableHours,
              '0' AS lastMonthNonBillableHours,
              '$0.00' AS cost,
              Comments AS comments,
              NonBillableAging AS nonBillableAging,
              'No timesheet filled' AS timesheetAging
          FROM SimpleEmployeeData
        
        SELECT TOP ${pageSize}
            id,
            zohoId,
            name,
            department,
            location,
            billableStatus,
            businessUnit,
            client AS clientSecurity,
            client,
            project,
            lastMonthBillable,
            lastMonthBillableHours,
            lastMonthNonBillableHours,
            cost,
            comments,
            nonBillableAging,
            timesheetAging
        FROM FilteredData
        ${whereClause}
        ORDER BY EmployeeNumber
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY`;

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
        ORDER BY id
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
        ['Non-Billable <=10 days', 'Non-Billable >10 days', 'Non-Billable >30 days', 'Non-Billable >60 days', 'Non-Billable >90 days'].forEach(aging => {
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
