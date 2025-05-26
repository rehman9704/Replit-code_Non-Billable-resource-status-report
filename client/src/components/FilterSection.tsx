import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type FilterOptions = {
  departments: string[];
  billableStatuses: string[];
  businessUnits: string[];
  clients: string[];
  projects: string[];
  timesheetAgings: string[];
};

type FilterSectionProps = {
  filterOptions: FilterOptions;
  filters: {
    department: string;
    billableStatus: string;
    businessUnit: string;
    client: string;
    project: string;
    timesheetAging: string;
  };
  onFilterChange: (field: string, value: string) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
  totalEmployees?: number;
};

const FilterSection: React.FC<FilterSectionProps> = ({
  filterOptions,
  filters,
  onFilterChange,
  onResetFilters,
  isLoading = false,
  totalEmployees = 0,
}) => {
  return (
    <div className="bg-white mb-6 p-2 flex flex-wrap gap-2 items-center">
      {/* Employee Count Display */}
      <div className="mr-4">
        <div className="text-lg font-bold text-blue-900">
          Count of Employee: {totalEmployees}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium mb-1">Department Name</Label>
        <Select 
          value={filters.department || ""}
          onValueChange={(value) => onFilterChange('department', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 px-3 min-w-[150px] text-sm border border-gray-200">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {filterOptions.departments.map((department) => (
              <SelectItem key={department} value={department}>{department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium mb-1">Billable Status</Label>
        <Select 
          value={filters.billableStatus || ""} 
          onValueChange={(value) => onFilterChange('billableStatus', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 px-3 min-w-[150px] text-sm border border-gray-200">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {filterOptions.billableStatuses.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Business Unit</Label>
        <Select 
          value={filters.businessUnit || ""} 
          onValueChange={(value) => onFilterChange('businessUnit', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 px-3 min-w-[150px] text-sm border border-gray-200">
            <SelectValue placeholder="All Business Units" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Business Units</SelectItem>
            {filterOptions.businessUnits.map((unit) => (
              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Client Name</Label>
        <Select 
          value={filters.client || ""} 
          onValueChange={(value) => onFilterChange('client', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 px-3 min-w-[150px] text-sm border border-gray-200">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {filterOptions.clients.map((client) => (
              <SelectItem key={client} value={client}>{client}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Project Name</Label>
        <Select 
          value={filters.project || ""} 
          onValueChange={(value) => onFilterChange('project', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 px-3 min-w-[150px] text-sm border border-gray-200">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {filterOptions.projects.map((project) => (
              <SelectItem key={project} value={project}>{project}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Timesheet Aging</Label>
        <Select 
          value={filters.timesheetAging || ""} 
          onValueChange={(value) => onFilterChange('timesheetAging', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 px-3 min-w-[150px] text-sm border border-gray-200">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filterOptions.timesheetAgings.map((aging) => (
              <SelectItem key={aging} value={aging}>{aging}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto">
        <Button
          variant="destructive"
          onClick={onResetFilters}
          className="h-8 px-3 text-sm"
          disabled={isLoading}
        >
          Reset Filters
        </Button>
      </div>
    </div>
  );
};

export default FilterSection;
