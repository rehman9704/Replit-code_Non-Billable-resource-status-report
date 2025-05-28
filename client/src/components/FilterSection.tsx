import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { exportToExcel } from "@/lib/utils/excelExport";
import { Employee } from "@shared/schema";

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
    department: string[];
    billableStatus: string[];
    businessUnit: string[];
    client: string[];
    project: string[];
    timesheetAging: string[];
  };
  onFilterChange: (field: string, value: string[]) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
  totalEmployees?: number;
  employees?: Employee[];
};

// Multi-select dropdown component that looks like regular Select
const MultiSelectDropdown: React.FC<{
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  allLabel: string;
  disabled?: boolean;
}> = ({ options, selectedValues, onChange, placeholder, allLabel, disabled }) => {
  const displayText = selectedValues.length === 0 
    ? placeholder 
    : selectedValues.length === 1 
    ? selectedValues[0]
    : `${selectedValues.length} selected`;

  const handleToggle = (value: string) => {
    if (value === "all") {
      onChange([]);
      return;
    }
    
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className="h-8 px-3 min-w-[150px] text-sm border border-gray-200 bg-white rounded-md flex items-center justify-between hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled}
        >
          <span className="text-left truncate">{displayText}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="max-h-60 overflow-y-auto">
          <div className="p-2 border-b">
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <Checkbox 
                checked={selectedValues.length === 0}
                onCheckedChange={() => onChange([])}
              />
              <span className="text-sm">{allLabel}</span>
            </label>
          </div>
          <div className="p-2">
            {options.map((option) => (
              <label key={option} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <Checkbox 
                  checked={selectedValues.includes(option)}
                  onCheckedChange={() => handleToggle(option)}
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const FilterSection: React.FC<FilterSectionProps> = ({
  filterOptions,
  filters,
  onFilterChange,
  onResetFilters,
  isLoading = false,
  totalEmployees = 0,
  employees = [],
}) => {
  return (
    <div className="bg-white mb-6 p-2 flex flex-wrap gap-2 items-center">
      <div>
        <Label className="text-sm font-medium mb-1">Department Name</Label>
        <MultiSelectDropdown
          options={filterOptions.departments}
          selectedValues={filters.department}
          onChange={(values) => onFilterChange('department', values)}
          placeholder="All Departments"
          allLabel="All Departments"
          disabled={isLoading}
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-1">Billable Status</Label>
        <MultiSelectDropdown
          options={filterOptions.billableStatuses}
          selectedValues={filters.billableStatus}
          onChange={(values) => onFilterChange('billableStatus', values)}
          placeholder="All Statuses"
          allLabel="All Statuses"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Business Unit</Label>
        <MultiSelectDropdown
          options={filterOptions.businessUnits}
          selectedValues={filters.businessUnit}
          onChange={(values) => onFilterChange('businessUnit', values)}
          placeholder="All Business Units"
          allLabel="All Business Units"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Client Name</Label>
        <MultiSelectDropdown
          options={filterOptions.clients}
          selectedValues={filters.client}
          onChange={(values) => onFilterChange('client', values)}
          placeholder="All Clients"
          allLabel="All Clients"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Project Name</Label>
        <MultiSelectDropdown
          options={filterOptions.projects}
          selectedValues={filters.project}
          onChange={(values) => onFilterChange('project', values)}
          placeholder="All Projects"
          allLabel="All Projects"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-1">Timesheet Ageing</Label>
        <MultiSelectDropdown
          options={filterOptions.timesheetAgings}
          selectedValues={filters.timesheetAging}
          onChange={(values) => onFilterChange('timesheetAging', values)}
          placeholder="All"
          allLabel="All"
          disabled={isLoading}
        />
      </div>

      <div className="ml-auto flex gap-2">
        <Button 
          onClick={() => exportToExcel(employees, 'Non_Billable_Resource_Status_Report')}
          className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-sm flex items-center gap-1"
          disabled={isLoading}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export to Excel
        </Button>
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
