import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FilterSection, { FilterOptions } from "@/components/FilterSection";
import EmployeeTable from "@/components/EmployeeTable";
import { Employee, EmployeeFilter } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

const Dashboard: React.FC = () => {
  // Filter state
  const [filters, setFilters] = useState<EmployeeFilter>({
    department: "",
    billableStatus: "",
    businessUnit: "",
    client: "",
    project: "",
    timesheetAging: "",
    search: "",
    page: 1,
    pageSize: 1000, // Show all records on one page
    sortBy: "",
    sortOrder: "asc",
  });

  // Fetch filter options for dropdowns
  const {
    data: filterOptions,
    isLoading: isLoadingFilterOptions,
    isError: isErrorFilterOptions,
  } = useQuery({
    queryKey: ["/api/filter-options"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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

  // Handle filter changes
  const handleFilterChange = (field: string, value: string) => {
    // Update filter value
    console.log(`Setting filter ${field} to value: ${value}`);
    
    setFilters((prev) => ({
      ...prev,
      [field]: value === "all" ? "" : value,
      page: 1, // Reset to first page on filter change
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      department: "",
      billableStatus: "",
      businessUnit: "",
      client: "",
      project: "",
      timesheetAging: "",
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
            <div className="flex items-center">
              <div className="bg-white px-4 py-1 rounded-lg">
                <span className="text-blue-900 font-bold text-lg">Count of Employees: {employeesData?.total || 0}</span>
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
              <div className="flex items-center">
                <span className="mr-3 text-sm text-white">Admin User</span>
                <div className="h-8 w-8 rounded-full bg-white text-blue-800 flex items-center justify-center font-bold">
                  <span className="text-sm">AU</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pb-10 px-8 max-w-full mx-auto">
        


        {/* Error Alert for Filter Options */}
        {isErrorFilterOptions && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load filter options. Please refresh the page or try again later.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter Section */}
        {isLoadingFilterOptions ? (
          <div className="mb-6">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ) : filterOptions ? (
          <FilterSection
            filterOptions={filterOptions as FilterOptions}
            filters={{
              department: filters.department || "",
              billableStatus: filters.billableStatus || "",
              businessUnit: filters.businessUnit || "",
              client: filters.client || "",
              project: filters.project || "",
              timesheetAging: filters.timesheetAging || "",
            }}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            isLoading={isLoadingEmployees}
            totalEmployees={employeesData?.total || 0}
            employees={(employeesData?.data as Employee[]) || []}
          />
        ) : null}

        {/* Employee Table */}
        <EmployeeTable
          employees={(employeesData?.data as Employee[]) || []}
          isLoading={isLoadingEmployees}
          isError={isErrorEmployees}
          pageCount={employeesData?.totalPages || 1}
          totalRows={employeesData?.total || 0}
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
