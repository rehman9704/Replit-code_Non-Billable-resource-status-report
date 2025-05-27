import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileSpreadsheet, ChevronDown } from "lucide-react";
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

// Multi-select filter component
const MultiSelectFilter: React.FC<{
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}> = ({ label, options, selectedValues, onSelectionChange, placeholder, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedValues, value]);
    } else {
      onSelectionChange(selectedValues.filter(v => v !== value));
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues.length} selected`;
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-1">{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-8 px-3 min-w-[150px] text-sm border border-gray-200 justify-between"
            disabled={disabled}
          >
            <span className="truncate">{getDisplayText()}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${label}-${option}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => handleCheckboxChange(option, !!checked)}
                />
                <Label
                  htmlFor={`${label}-${option}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
      <MultiSelectFilter
        label="Department Name"
        options={filterOptions.departments}
        selectedValues={filters.department}
        onSelectionChange={(values) => onFilterChange('department', values)}
        placeholder="All Departments"
        disabled={isLoading}
      />

      <MultiSelectFilter
        label="Billable Status"
        options={filterOptions.billableStatuses}
        selectedValues={filters.billableStatus}
        onSelectionChange={(values) => onFilterChange('billableStatus', values)}
        placeholder="All Statuses"
        disabled={isLoading}
      />

      <MultiSelectFilter
        label="Business Unit"
        options={filterOptions.businessUnits}
        selectedValues={filters.businessUnit}
        onSelectionChange={(values) => onFilterChange('businessUnit', values)}
        placeholder="All Business Units"
        disabled={isLoading}
      />

      <MultiSelectFilter
        label="Client Name"
        options={filterOptions.clients}
        selectedValues={filters.client}
        onSelectionChange={(values) => onFilterChange('client', values)}
        placeholder="All Clients"
        disabled={isLoading}
      />

      <MultiSelectFilter
        label="Project Name"
        options={filterOptions.projects}
        selectedValues={filters.project}
        onSelectionChange={(values) => onFilterChange('project', values)}
        placeholder="All Projects"
        disabled={isLoading}
      />

      <MultiSelectFilter
        label="Timesheet Ageing"
        options={filterOptions.timesheetAgings}
        selectedValues={filters.timesheetAging}
        onSelectionChange={(values) => onFilterChange('timesheetAging', values)}
        placeholder="All"
        disabled={isLoading}
      />

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
