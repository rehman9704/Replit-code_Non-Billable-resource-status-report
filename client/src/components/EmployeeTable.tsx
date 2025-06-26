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
import ChatNotification from "./ChatNotification";
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
      header: () => (
        <div className="text-left text-xs font-semibold px-2 py-2 leading-tight">
          Zoho Id
        </div>
      ),
      size: 100,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-2 min-h-[50px] flex items-center w-[100px]">
          {row.getValue("zohoId")}
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      size: 100,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[100px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("department")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      size: 80,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[80px]">
          <span className="leading-tight break-words whitespace-normal">
            {row.getValue("location")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "billableStatus",
      header: () => (
        <div className="text-left text-xs font-semibold px-1 py-2 leading-tight">
          <div className="mb-0.5">Billable</div>
          <div>Status</div>
        </div>
      ),
      size: 110,
      cell: ({ row }) => {
        const status = row.getValue("billableStatus") as string;
        return (
          <div className="py-2 px-1 min-h-[50px] flex items-center w-[110px]">
            <Badge className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${getStatusClass(status)} whitespace-normal text-center max-w-full`}>
              <span className="break-words">{status}</span>
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "businessUnit",
      header: () => (
        <div className="text-left text-xs font-semibold px-1 py-2 leading-tight">
          <div className="mb-0.5">Business</div>
          <div>Unit</div>
        </div>
      ),
      size: 110,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[110px]">
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
        <div className="text-left text-xs font-semibold px-2 py-2 leading-relaxed min-h-[60px] flex flex-col justify-center">
          <div className="mb-0.5">Last Month</div>
          <div className="mb-0.5">Logged</div>
          <div>Billable Hours</div>
        </div>
      ),
      size: 140,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[140px]">
          {formatNumber(parseFloat(row.getValue("lastMonthBillableHours")))}
        </div>
      ),
    },
    {
      accessorKey: "lastMonthNonBillableHours", 
      header: () => (
        <div className="text-left text-xs font-semibold px-2 py-2 leading-relaxed min-h-[60px] flex flex-col justify-center">
          <div className="mb-0.5">Last Month</div>
          <div className="mb-0.5">Logged Non</div>
          <div>Billable Hours</div>
        </div>
      ),
      size: 150,
      cell: ({ row }) => (
        <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[150px]">
          {formatNumber(parseFloat(row.getValue("lastMonthNonBillableHours")))}
        </div>
      ),
    },
    {
      accessorKey: "cost",
      header: "Cost ($)", 
      size: 90,
      cell: ({ row }) => {
        const costValue = row.getValue("cost") as string;
        // Remove $ sign and parse to number, then format without decimals
        const numericValue = parseFloat(costValue.replace(/[$,]/g, ''));
        return (
          <div className="text-sm text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[90px]">
            {Math.round(numericValue).toLocaleString()}
          </div>
        );
      },
    },
    {
      accessorKey: "comments",
      header: () => (
        <div className="text-left text-xs font-semibold px-1 py-2 leading-tight">
          <div className="mb-0.5">Live</div>
          <div>Chat</div>
        </div>
      ),
      size: 60, // Ultra minimized size for Live Chat
      cell: ({ row }) => {
        const comments = row.getValue("comments") as string || "-";
        const employee = row.original;
        
        return (
          <div className="flex flex-col w-[60px] py-2 px-1 min-h-[50px] items-center">
            <div className="flex items-center mb-1">
              <CommentChat 
                employeeId={parseInt(employee.id)} 
                employeeName={employee.name}
                initialComment={comments !== "-" ? comments : undefined}
                showInComments={true}
                zohoId={employee.zohoId}
                department={employee.department}
                billableStatus={employee.billableStatus}
                cost={parseFloat(employee.cost.replace(/[$,]/g, '')) || 0}
              />
            </div>
            <div className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 break-words whitespace-normal leading-tight">
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
