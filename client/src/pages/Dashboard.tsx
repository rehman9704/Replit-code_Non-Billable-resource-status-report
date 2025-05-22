import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FilterSection, { FilterOptions } from "@/components/FilterSection";
import EmployeeTable from "@/components/EmployeeTable";
import { Employee, EmployeeFilter } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard: React.FC = () => {
  // Filter state
  const [filters, setFilters] = useState<EmployeeFilter>({
    department: "",
    status: "",
    businessUnit: "",
    client: "",
    project: "",
    timesheetAging: "",
    search: "",
    page: 1,
    pageSize: 10,
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
    // If value is "all", set to empty string for the API
    const apiValue = value === "all" ? "" : value;
    
    setFilters((prev) => ({
      ...prev,
      [field]: apiValue,
      page: 1, // Reset to first page on filter change
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      department: "",
      status: "",
      businessUnit: "",
      client: "",
      project: "",
      timesheetAging: "",
      search: "",
      page: 1,
      pageSize: 10,
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
    setFilters((prev) => ({
      ...prev,
      search: value,
      page: 1, // Reset to first page on search
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-text-primary">
      {/* Navbar */}
      <nav className="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-primary">Employee Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center">
              <div className="ml-3 relative flex items-center">
                <span className="mr-2 text-sm text-text-secondary">Admin User</span>
                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center">
                  <span className="text-sm font-medium">AU</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-20 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Financial Report</h2>
          <p className="text-text-secondary">Comprehensive employee financial data for analysis</p>
        </div>

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
              status: filters.status || "",
              businessUnit: filters.businessUnit || "",
              client: filters.client || "",
              project: filters.project || "",
              timesheetAging: filters.timesheetAging || "",
            }}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            isLoading={isLoadingEmployees}
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
