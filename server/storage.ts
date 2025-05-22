import { 
  Employee, 
  InsertEmployee, 
  EmployeeFilter, 
  FilterOptions
} from "@shared/schema";

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
      
      if (filter.status && filter.status !== '') {
        employees = employees.filter(emp => emp.status === filter.status);
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
    const departments = [...new Set(employees.map(emp => emp.department))];
    const statuses = [...new Set(employees.map(emp => emp.status))];
    const businessUnits = [...new Set(employees.map(emp => emp.businessUnit))];
    const clients = [...new Set(employees.map(emp => emp.client))];
    const projects = [...new Set(employees.map(emp => emp.project))];
    const timesheetAgings = [...new Set(employees.map(emp => emp.timesheetAging))];
    
    return {
      departments,
      statuses,
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

export const storage = new MemStorage();
