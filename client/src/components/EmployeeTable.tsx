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
import { getCorrectEmployeeName } from "@/lib/employeeMapping";
import { LiveChatDialog } from "@/components/LiveChatDialog";

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
      cell: ({ row }) => {
        const employee = row.original;
        let employeeName = row.getValue("name") as string;
        
        // Apply phantom employee name correction
        employeeName = getCorrectEmployeeName(employee.id, employeeName);
        
        // Debug logging for Employee ID 2 specifically to track phantom "Abdullah Wasi"
        if (employee.id === 2) {
          console.log('🎯 EMPLOYEE ID 2 DISPLAY DEBUG:', {
            id: employee.id,
            name: employee.name,
            cellValue: employeeName,
            zohoId: employee.zohoId,
            fullEmployeeData: employee
          });
          
          // Phantom employee detection disabled to prevent infinite loops
          // if (employeeName === 'Abdullah Wasi' || employee.name === 'Abdullah Wasi') {
          //   console.log('🚨 PHANTOM "Abdullah Wasi" DETECTED - FORCING BROWSER REFRESH');
          //   setTimeout(() => {
          //     if (typeof window !== 'undefined') {
          //       window.location.reload();
          //     }
          //   }, 100);
          // }
        }
        
        return (
          <div className="text-sm font-medium text-text-primary py-2 px-1 min-h-[50px] flex items-center w-[180px]">
            <span className="leading-tight break-words whitespace-normal">
              {employeeName}
            </span>
          </div>
        );
      },
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
      id: "feedbackform",
      header: "Feedback Form",
      size: 120,
      cell: ({ row }) => {
        const employee = row.original;
        const zohoId = employee.zohoId;
        
        // Create the Zoho feedback form URL with the employee's Zoho ID
        const feedbackUrl = `https://people.zoho.com/royalcyberinc/zp#operations/performance/resource_feedback/listview-empstatus:all/searchBy:%5B%7B%22Employee1_ids%22%3A%5B%22${zohoId}%22%5D%2C%22Employee1_idFlag%22%3A%5B0%5D%2C%22Employee1%22%3A%22${zohoId}%22%2C%22Employee1_op%22%3A%2226%22%7D%5D`;
        
        return (
          <div className="py-2 px-1 min-h-[50px] flex items-center justify-center w-[120px]">
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Feedback
            </a>
          </div>
        );
      },
    },

    {
      id: "livechat",
      header: "Live Chat",
      size: 100,
      cell: ({ row }) => {
        const employee = row.original;
        const employeeName = getCorrectEmployeeName(employee.id, employee.name);
        
        return (
          <div className="py-2 px-1 min-h-[50px] flex items-center justify-center w-[100px]">
            <LiveChatDialog
              zohoId={employee.zohoId}
              employeeName={employeeName}
              employeeId={employee.id?.toString()}
              department={employee.department}
              buttonText="Chat"
              showCommentCount={true}
              status={employee.status}
              cost={employee.cost}
              nonBillableAging={employee.nonBillableAging}
              client={employee.client}
            />
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
