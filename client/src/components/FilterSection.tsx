import React, { useState, useEffect } from "react";
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
  locations: string[];
  nonBillableAgings: string[];
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
    location: string[];
    nonBillableAging: string[];
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
  const [tempSelectedValues, setTempSelectedValues] = useState<string[]>(selectedValues);
  
  const displayText = tempSelectedValues.length === 0 
    ? placeholder 
    : tempSelectedValues.length === 1 
    ? tempSelectedValues[0]
    : `${tempSelectedValues.length} items selected`;

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Update temp values when selectedValues prop changes
  useEffect(() => {
    setTempSelectedValues(selectedValues);
  }, [selectedValues]);

  const handleToggle = (value: string) => {
    console.log('Toggling value:', value, 'Current temp selected:', tempSelectedValues);
    
    if (value === "all") {
      console.log('Clearing all temp selections');
      setTempSelectedValues([]);
      return;
    }
    
    const newValues = tempSelectedValues.includes(value)
      ? tempSelectedValues.filter(v => v !== value)
      : [...tempSelectedValues, value];
    
    console.log('New temp values:', newValues);
    setTempSelectedValues(newValues);
    // Don't call onChange here - wait until dropdown closes
  };

  const handleDropdownClose = () => {
    console.log('Dropdown closing, applying filters:', tempSelectedValues);
    onChange(tempSelectedValues);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleDropdownClose();
      } else {
        setIsOpen(true);
      }
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
        onPointerDownOutside={handleDropdownClose}
        onEscapeKeyDown={handleDropdownClose}
      >
        <div 
          className="max-h-60 overflow-y-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
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
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleToggle("all");
              }}
            >
              <Checkbox
                id="all"
                checked={tempSelectedValues.length === 0}
                onCheckedChange={(checked) => {
                  handleToggle("all");
                }}
              />
              <label 
                htmlFor="all" 
                className="text-sm cursor-pointer flex-1"
                onMouseDown={(e) => e.preventDefault()}
              >
                {allLabel}
              </label>
            </div>
            {filteredOptions.map((option) => (
              <div 
                key={option} 
                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToggle(option);
                }}
              >
                <Checkbox
                  id={option}
                  checked={tempSelectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    handleToggle(option);
                  }}
                />
                <label 
                  htmlFor={option} 
                  className="text-sm cursor-pointer flex-1"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {option}
                </label>
              </div>
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

      <div>
        <Label className="text-sm font-medium mb-1">Location</Label>
        <MultiSelectDropdown
          options={filterOptions.locations}
          selectedValues={filters.location}
          onChange={(values) => onFilterChange('location', values)}
          placeholder="All Locations"
          allLabel="All Locations"
          disabled={isLoading}
          searchable={true}
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-1">Non-Billable Ageing</Label>
        <MultiSelectDropdown
          options={filterOptions.nonBillableAgings}
          selectedValues={filters.nonBillableAging}
          onChange={(values) => onFilterChange('nonBillableAging', values)}
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