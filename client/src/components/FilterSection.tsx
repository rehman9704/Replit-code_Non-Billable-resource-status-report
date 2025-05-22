import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type FilterOptions = {
  departments: string[];
  statuses: string[];
  businessUnits: string[];
  clients: string[];
  projects: string[];
  timesheetAgings: string[];
};

type FilterSectionProps = {
  filterOptions: FilterOptions;
  filters: {
    department: string;
    status: string;
    businessUnit: string;
    client: string;
    project: string;
    timesheetAging: string;
  };
  onFilterChange: (field: string, value: string) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
};

const FilterSection: React.FC<FilterSectionProps> = ({
  filterOptions,
  filters,
  onFilterChange,
  onResetFilters,
  isLoading = false,
}) => {
  return (
    <Card className="bg-white rounded-lg shadow-sm mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Filters</h3>
            <Button
              variant="ghost"
              onClick={onResetFilters}
              className="text-primary text-sm font-medium hover:text-primary/80 transition-colors"
              disabled={isLoading}
            >
              Reset Filters
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Department Filter */}
            <div>
              <Label className="block text-sm font-medium text-text-secondary mb-1">Department</Label>
              <Select 
                value={filters.department} 
                onValueChange={(value) => onFilterChange('department', value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full border border-neutral-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  {filterOptions.departments.map((department) => (
                    <SelectItem key={department} value={department}>{department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Status Filter */}
            <div>
              <Label className="block text-sm font-medium text-text-secondary mb-1">Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => onFilterChange('status', value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full border border-neutral-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  {filterOptions.statuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Business Unit Filter */}
            <div>
              <Label className="block text-sm font-medium text-text-secondary mb-1">Business Unit</Label>
              <Select 
                value={filters.businessUnit} 
                onValueChange={(value) => onFilterChange('businessUnit', value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full border border-neutral-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="All Business Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Business Units</SelectItem>
                  {filterOptions.businessUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Client Filter */}
            <div>
              <Label className="block text-sm font-medium text-text-secondary mb-1">Client</Label>
              <Select 
                value={filters.client} 
                onValueChange={(value) => onFilterChange('client', value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full border border-neutral-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Clients</SelectItem>
                  {filterOptions.clients.map((client) => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Project Filter */}
            <div>
              <Label className="block text-sm font-medium text-text-secondary mb-1">Project</Label>
              <Select 
                value={filters.project} 
                onValueChange={(value) => onFilterChange('project', value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full border border-neutral-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {filterOptions.projects.map((project) => (
                    <SelectItem key={project} value={project}>{project}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Timesheet Aging Filter */}
            <div>
              <Label className="block text-sm font-medium text-text-secondary mb-1">Timesheet Aging</Label>
              <Select 
                value={filters.timesheetAging} 
                onValueChange={(value) => onFilterChange('timesheetAging', value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full border border-neutral-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {filterOptions.timesheetAgings.map((aging) => (
                    <SelectItem key={aging} value={aging}>{aging}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FilterSection;
