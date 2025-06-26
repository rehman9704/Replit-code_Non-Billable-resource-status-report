import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Multi-select dropdown component that looks like regular Select with search
const MultiSelectDropdown: React.FC<{
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  allLabel: string;
  disabled?: boolean;
  searchable?: boolean;
}> = ({ options, selectedValues, onChange, placeholder, allLabel, disabled, searchable = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const displayText = selectedValues.length === 0 
    ? placeholder 
    : selectedValues.length === 1 
    ? selectedValues[0]
    : `${selectedValues.length} items selected`;

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleToggle = (value: string) => {
    console.log('Toggling value:', value, 'Current selected:', selectedValues);
    
    if (value === "all") {
      console.log('Clearing all selections');
      onChange([]);
      return;
    }
    
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    console.log('New values:', newValues);
    onChange(newValues);
    // Keep dropdown open for multi-selection
  };

  return (
    <Popover open={isOpen} onOpenChange={() => {
      // Prevent automatic closing - only allow manual close via Done button
    }}>
      <PopoverTrigger asChild>
        <button 
          className="h-8 px-3 min-w-[150px] text-sm border border-gray-200 bg-white rounded-md flex items-center justify-between hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-left truncate">{displayText}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <div className="max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between p-2 border-b bg-gray-50">
            <span className="text-sm font-medium">Select Options</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsOpen(false)}
            >
              ×
            </Button>
          </div>
          {searchable && (
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          )}
          <div className="p-1">
            <div 
              className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleToggle("all");
              }}
            >
              <Checkbox
                id="all"
                checked={selectedValues.length === 0}
                onCheckedChange={(checked) => {
                  handleToggle("all");
                }}
              />
              <label htmlFor="all" className="text-sm cursor-pointer flex-1">
                {allLabel}
              </label>
            </div>
            {filteredOptions.map((option) => (
              <div 
                key={option} 
                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToggle(option);
                }}
              >
                <Checkbox
                  id={option}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    handleToggle(option);
                  }}
                />
                <label htmlFor={option} className="text-sm cursor-pointer flex-1">
                  {option}
                </label>
              </div>
            ))}
            <div className="p-2 border-t bg-gray-50">
              <Button
                variant="default"
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setIsOpen(false)}
              >
                Apply Filters ({selectedValues.length} selected)
              </Button>
            </div>
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
          searchable={true}
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
          searchable={true}
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
          searchable={true}
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
          searchable={true}
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