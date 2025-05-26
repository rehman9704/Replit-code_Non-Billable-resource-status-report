import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Employee } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, getStatusClass } from "@/lib/utils/formatting";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileSpreadsheet } from "lucide-react";
import CommentChat from "./CommentChat";
import RecentChatSummary from "./RecentChatSummary";
import { exportToExcel } from "@/lib/utils/excelExport";

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
      size: 180,
      cell: ({ row }) => (
        <div className="text-sm font-medium text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[180px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("name")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "zohoId",
      header: "Zoho ID",
      size: 80,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[80px]">
          {row.getValue("zohoId")}
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      size: 120,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[120px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("department")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "billableStatus",
      header: "Billable Status",
      size: 130,
      cell: ({ row }) => {
        const status = row.getValue("billableStatus") as string;
        return (
          <div className="py-2 px-1 min-h-[50px] flex items-center w-[130px]">
            <Badge className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${getStatusClass(status)} whitespace-normal text-center max-w-full`}>
              <span className="break-words">{status}</span>
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "businessUnit",
      header: "Business Unit",
      size: 100,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[100px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("businessUnit")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "client",
      header: "Client",
      size: 120,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[120px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("client")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "project",
      header: "Project",
      size: 130,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[130px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("project")}
          </span>
        </div>
      ),
    },

    {
      accessorKey: "lastMonthBillableHours",
      header: () => (
        <div className="text-center leading-tight text-xs font-semibold">
          <div>Last Month</div>
          <div>Logged</div>
          <div>Billable Hours</div>
        </div>
      ),
      size: 110,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[110px] justify-center">
          {formatNumber(parseFloat(row.getValue("lastMonthBillableHours")))}
        </div>
      ),
    },
    {
      accessorKey: "lastMonthNonBillableHours", 
      header: () => (
        <div className="text-center leading-tight text-xs font-semibold">
          <div>Last Month</div>
          <div>Logged Non</div>
          <div>Billable Hours</div>
        </div>
      ),
      size: 110,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[110px] justify-center">
          {formatNumber(parseFloat(row.getValue("lastMonthNonBillableHours")))}
        </div>
      ),
    },
    {
      accessorKey: "cost",
      header: "Cost", 
      size: 110,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-2 min-h-[50px] flex items-center w-[110px] justify-end">
          {row.getValue("cost")}
        </div>
      ),
    },
    {
      accessorKey: "comments",
      header: "Live Chat",
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
