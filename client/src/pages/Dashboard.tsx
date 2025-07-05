import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FilterSection, { FilterOptions } from "@/components/FilterSection";
import EmployeeTable from "@/components/EmployeeTable";
import { Employee, EmployeeFilter } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Search, LogOut, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface FilterState {
  department: string[];
  billableStatus: string[];
  businessUnit: string[];
  client: string[];
  project: string[];
  timesheetAging: string[];
  location: string[];
  nonBillableAging: string[];
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  
  // Filter state - updated to support multi-select arrays
  const [filters, setFilters] = useState<FilterState>({
    department: [],
    billableStatus: [],
    businessUnit: [],
    client: [],
    project: [],
    timesheetAging: [],
    location: [],
    nonBillableAging: [],
    search: "",
    page: 1,
    pageSize: 1000, // Show all records on one page
    sortBy: "",
    sortOrder: "asc",
  });

  // Fetch filter options from backend
  const {
    data: filterOptionsData,
    isLoading: isLoadingFilterOptions,
  } = useQuery({
    queryKey: ["/api/filter-options"],
    staleTime: 60 * 1000, // 1 minute
  });

  // Generate filter options dynamically from current employee data (PowerBI-style) as fallback
  const generateFilterOptions = (employees: Employee[]): FilterOptions => {
    if (!employees || employees.length === 0) {
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

    const departments = Array.from(new Set(employees.map(emp => emp.department).filter(d => d && d.trim()))).sort();
    const billableStatuses = Array.from(new Set(employees.map(emp => emp.billableStatus).filter(s => s && s.trim()))).sort();
    const businessUnits = Array.from(new Set(employees.map(emp => emp.businessUnit).filter(b => b && b.trim()))).sort();
    const clients = Array.from(new Set(employees.map(emp => emp.client).filter(c => c && c.trim() && !c.includes('No Client')))).sort();
    const projects = Array.from(new Set(employees.map(emp => emp.project).filter(p => p && p.trim() && !p.includes('No Project')))).sort();
    const timesheetAgings = Array.from(new Set(employees.map(emp => emp.timesheetAging).filter(t => t && t.trim()))).sort();
    const locations = Array.from(new Set(employees.map(emp => emp.location).filter(l => l && l.trim()))).sort();

    return {
      departments,
      billableStatuses,
      businessUnits,
      clients,
      projects,
      timesheetAgings,
      locations,
      nonBillableAgings: [
        'Non-Billable >10 days',
        'Non-Billable >30 days', 
        'Non-Billable >60 days',
        'Non-Billable >90 days',
        'No timesheet filled'
      ]
    };
  };

  // Log filters when they change
  useEffect(() => {
    console.log(`🔧 Filters updated:`, filters);
    console.log(`🔧 nonBillableAging specifically:`, filters.nonBillableAging);
  }, [filters]);

  // Fetch employees with current filters
  const {
    data: employeesData,
    isLoading: isLoadingEmployees,
    isError: isErrorEmployees,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ["/api/employees", filters],
    staleTime: 30 * 1000, // 30 seconds
  });

  // Use backend filter options if available, otherwise generate from employee data
  const filterOptions = filterOptionsData || generateFilterOptions((employeesData as any)?.data || []);

  // Handle filter changes - updated for multi-select arrays
  const handleFilterChange = (field: string, value: string[]) => {
    console.log(`🔧 Setting filter ${field} to values:`, value);
    console.log(`🔧 Current filters before change:`, filters);
    
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      page: 1, // Reset to first page on filter change
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      department: [],
      billableStatus: [],
      businessUnit: [],
      client: [],
      project: [],
      timesheetAging: [],
      location: [],
      nonBillableAging: [],
      search: "",
      page: 1,
      pageSize: 1000, // Show all records on one page
      sortBy: "",
      sortOrder: "asc",
    });
  };

  // Handle pagination change
  const handlePaginationChange = (pageIndex: number, pageSize: number) => {
    setFilters((prev) => ({
      ...prev,
      page: pageIndex + 1,
      pageSize,
    }));
  };

  // Handle sorting change
  const handleSortingChange = (sorting: { id: string; desc: boolean }[]) => {
    if (sorting.length === 0) {
      setFilters((prev) => ({
        ...prev,
        sortBy: "",
        sortOrder: "asc",
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        sortBy: sorting[0].id,
        sortOrder: sorting[0].desc ? "desc" : "asc",
      }));
    }
  };

  // Handle search
  const handleSearchChange = (value: string) => {
    console.log('Search value:', value);
    setFilters((prev) => ({
      ...prev,
      search: value,
      page: 1, // Reset to first page on search
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700">
      {/* Header */}
      <div className="bg-blue-900 shadow-xl border-b-4 border-blue-600">
        <div className="max-w-full mx-auto px-8 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Non Billable Resource Status Report</h1>
            <p className="text-blue-200 text-lg">Executive Dashboard for Resource Management</p>
          </div>
        </div>
      </div>

      {/* Top Navigation Bar */}
      <nav className="bg-blue-800 shadow-lg">
        <div className="max-w-full mx-auto px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-4">
              <div className="bg-white px-3 py-1 rounded">
                <span className="text-blue-800 font-medium text-sm">Count of Employees: {(employeesData as any)?.total || 0}</span>
              </div>
              <div className="bg-white px-3 py-1 rounded">
                <span className="text-green-800 font-medium text-sm">Total Cost ($): {(((employeesData as any)?.data as Employee[])?.reduce((sum, emp) => {
                  const costValue = emp.cost?.toString() || '0';
                  const numericValue = parseFloat(costValue.replace(/[$,]/g, ''));
                  return sum + (isNaN(numericValue) ? 0 : Math.round(numericValue));
                }, 0) || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search by name, ID, department, status..."
                  className="py-2 px-4 rounded-lg text-sm w-80 border-2 border-blue-300 focus:border-white focus:outline-none"
                  value={filters.search || ""}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* Download Section */}
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/downloads/ACCURATE_Chat_Attribution_Report_2025-07-04T20-44-20.xlsx';
                      link.download = 'ACCURATE_Chat_Attribution_Report_2025-07-04T20-44-20.xlsx';
                      link.click();
                    }}
                    className="text-white hover:bg-blue-700 hover:text-white"
                    title="Download Chat Attribution Report"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download Report
                  </Button>
                </div>
                
                <span className="text-sm text-white">{user?.displayName || 'User'}</span>
                <div className="h-8 w-8 rounded-full bg-white text-blue-800 flex items-center justify-center font-bold">
                  <span className="text-sm">{user?.displayName?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'AU'}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    // Clear everything immediately
                    localStorage.removeItem('sessionId');
                    // Force immediate redirect to login
                    window.location.replace('/');
                  }}
                  className="text-white hover:bg-blue-700 hover:text-white"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pb-10 px-8 max-w-full mx-auto">
        


        {/* Filter Section - PowerBI style with dynamic options */}
        {isLoadingEmployees ? (
          <div className="mb-6">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ) : filterOptions ? (
          <FilterSection
            filterOptions={filterOptions as FilterOptions}
            filters={{
              department: filters.department || [],
              billableStatus: filters.billableStatus || [],
              businessUnit: filters.businessUnit || [],
              client: filters.client || [],
              project: filters.project || [],
              timesheetAging: filters.timesheetAging || [],
              location: filters.location || [],
              nonBillableAging: filters.nonBillableAging || [],
            }}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            isLoading={isLoadingEmployees}
            totalEmployees={(employeesData as any)?.total || 0}
            employees={((employeesData as any)?.data as Employee[]) || []}
          />
        ) : null}

        {/* Employee Table */}
        <EmployeeTable
          employees={((employeesData as any)?.data as Employee[]) || []}
          isLoading={isLoadingEmployees}
          isError={isErrorEmployees}
          pageCount={(employeesData as any)?.totalPages || 1}
          totalRows={(employeesData as any)?.total || 0}
          pagination={{
            pageIndex: (filters.page || 1) - 1,
            pageSize: filters.pageSize || 10,
          }}
          onPaginationChange={handlePaginationChange}
          onSortingChange={handleSortingChange}
          onSearchChange={handleSearchChange}
          searchValue={filters.search || ""}
        />
      </div>
    </div>
  );
};

export default Dashboard;
