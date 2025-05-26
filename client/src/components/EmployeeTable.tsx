import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Employee } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, getStatusClass } from "@/lib/utils/formatting";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import CommentChat from "./CommentChat";
import RecentChatSummary from "./RecentChatSummary";

type EmployeeTableProps = {
  employees: Employee[];
  isLoading: boolean;
  isError: boolean;
  pageCount: number;
  totalRows: number;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  onSortingChange: (sorting: { id: string; desc: boolean }[]) => void;
  onSearchChange: (value: string) => void;
  searchValue: string;
};

const EmployeeTable: React.FC<EmployeeTableProps> = ({
  employees,
  isLoading,
  isError,
  pageCount,
  totalRows,
  pagination,
  onPaginationChange,
  onSortingChange,
  onSearchChange,
  searchValue,
}) => {
  const columns: ColumnDef<Employee>[] = [
    {
      accessorKey: "name",
      header: "Employee Name",
      size: 150,
      cell: ({ row }) => (
        <div className="text-sm font-medium text-text-primary truncate max-w-[140px]">
          {row.getValue("name")}
        </div>
      ),
    },
    {
      accessorKey: "zohoId",
      header: "Zoho ID",
      size: 80,
      cell: ({ row }) => <div className="text-sm text-text-primary">{row.getValue("zohoId")}</div>,
    },
    {
      accessorKey: "department",
      header: "Department",
      size: 120,
      cell: ({ row }) => <div className="text-sm text-text-primary truncate max-w-[110px]">{row.getValue("department")}</div>,
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 90,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(status)}`}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "businessUnit",
      header: "Business Unit",
      size: 100,
      cell: ({ row }) => <div className="text-sm text-text-primary truncate max-w-[90px]">{row.getValue("businessUnit")}</div>,
    },
    {
      accessorKey: "client",
      header: "Client",
      size: 100,
      cell: ({ row }) => <div className="text-sm text-text-primary truncate max-w-[90px]">{row.getValue("client")}</div>,
    },
    {
      accessorKey: "project",
      header: "Project",
      size: 100,
      cell: ({ row }) => <div className="text-sm text-text-primary truncate max-w-[90px]">{row.getValue("project")}</div>,
    },
    {
      accessorKey: "lastMonthBillable",
      header: "Last Month Billable",
      size: 140,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("lastMonthBillable"));
        const formattedValue = formatCurrency(amount);
        return <div className={`text-sm font-medium ${amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{formattedValue}</div>;
      },
    },
    {
      accessorKey: "lastMonthBillableHours",
      header: "Billable Hours",
      size: 100,
      cell: ({ row }) => <div className="text-sm text-text-primary">{formatNumber(parseFloat(row.getValue("lastMonthBillableHours")))}</div>,
    },
    {
      accessorKey: "lastMonthNonBillableHours",
      header: "Non-Billable Hours",
      size: 130,
      cell: ({ row }) => <div className="text-sm text-text-primary">{formatNumber(parseFloat(row.getValue("lastMonthNonBillableHours")))}</div>,
    },
    {
      accessorKey: "cost",
      header: "Cost",
      size: 90,
      cell: ({ row }) => <div className="text-sm text-text-primary">{row.getValue("cost")}</div>,
    },
    {
      accessorKey: "comments",
      header: "Comments & Discussion",
      size: 300, // Set a wider fixed size for comments
      cell: ({ row }) => {
        const comments = row.getValue("comments") as string || "-";
        const employee = row.original;
        
        return (
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 mb-1">
              <div className="text-sm text-text-secondary flex-grow truncate max-w-[180px] font-medium">
                {comments}
              </div>
              <CommentChat 
                employeeId={employee.id} 
                employeeName={employee.name}
                initialComment={comments !== "-" ? comments : undefined}
                showInComments={true}
              />
            </div>
            <div className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
              <RecentChatSummary employeeId={employee.id} />
            </div>
          </div>
        );
      },
    },
  ];

  if (isError) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Error loading employee data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="flex justify-between items-center px-4 py-2 border-b">
        <div className="text-sm font-medium text-gray-700">
          {totalRows} employees found
        </div>
        <button 
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium py-1 px-4 rounded flex items-center space-x-1"
          onClick={() => {
            // Future implementation for CSV download
            console.log('Download CSV clicked');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download CSV</span>
        </button>
      </div>
      
      <DataTable
        columns={columns}
        data={employees}
        isLoading={isLoading}
        searchPlaceholder="Search employees..."
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        onSortingChange={(sorting) => {
          if (sorting.length > 0) {
            onSortingChange([{ id: sorting[0].id, desc: sorting[0].desc }]);
          } else {
            onSortingChange([]);
          }
        }}
        onSearchChange={onSearchChange}
        searchValue={searchValue}
        totalRows={totalRows}
      />
    </div>
  );
};

export default EmployeeTable;
