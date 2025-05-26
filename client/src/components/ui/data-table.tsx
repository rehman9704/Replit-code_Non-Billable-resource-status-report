import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  getPaginationRowModel,
  VisibilityState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  pageCount?: number;
  pagination?: {
    pageIndex: number;
    pageSize: number;
  };
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  isLoading?: boolean;
  totalRows?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  pageCount,
  pagination,
  onPaginationChange,
  onSortingChange,
  onSearchChange,
  searchValue = "",
  isLoading = false,
  totalRows = 0,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [search, setSearch] = React.useState(searchValue);

  // Update search state when searchValue prop changes
  React.useEffect(() => {
    setSearch(searchValue);
  }, [searchValue]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (newSorting) => {
      setSorting(newSorting);
      if (onSortingChange) {
        onSortingChange(newSorting as SortingState);
      }
    },
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      ...(pagination ? {
        pagination: {
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
        },
      } : {}),
    },
    manualPagination: !!onPaginationChange,
    pageCount: pageCount,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    
    // Debounce search input
    const timer = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(value);
      }
    }, 300);

    return () => clearTimeout(timer);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">

      <div className="rounded-md border w-full overflow-hidden">
        <div className="w-full">
          <Table className="w-full table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead 
                        key={header.id}
                        className="px-2 py-3 bg-gray-100 text-left text-xs font-semibold text-gray-700 tracking-wider hover:bg-gray-200 border-b border-gray-300"
                        style={{ width: header.getSize() || 'auto' }}
                      >
                        {header.isPlaceholder
                          ? null
                          : (
                            <div className="truncate">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </div>
                          )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full"></div>
                      <span className="ml-2 text-gray-500">Loading data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`border-b border-gray-200 hover:bg-blue-100 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-blue-100/50'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell 
                        key={cell.id} 
                        className="px-2 py-3 border-r border-gray-200 last:border-r-0"
                        style={{ width: cell.column.getSize() || 'auto' }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 sm:px-6 mt-4">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPaginationChange?.(
              Math.max(0, (pagination?.pageIndex || 0) - 1),
              pagination?.pageSize || 10
            )}
            disabled={!pagination || pagination.pageIndex === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPaginationChange?.(
              Math.min((pageCount || 0) - 1, (pagination?.pageIndex || 0) + 1),
              pagination?.pageSize || 10
            )}
            disabled={!pagination || pagination.pageIndex === (pageCount || 0) - 1}
          >
            Next
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-secondary">
              Showing <span className="font-medium">{pagination ? pagination.pageIndex * pagination.pageSize + 1 : 1}</span> to{" "}
              <span className="font-medium">
                {pagination ? Math.min(
                  (pagination.pageIndex + 1) * pagination.pageSize,
                  totalRows
                ) : Math.min(10, data.length)}
              </span>{" "}
              of <span className="font-medium">{totalRows || data.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <Button
                variant="outline"
                size="icon"
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-neutral-300 bg-white text-sm font-medium text-text-primary hover:bg-neutral-50"
                onClick={() => onPaginationChange?.(
                  Math.max(0, (pagination?.pageIndex || 0) - 1),
                  pagination?.pageSize || 10
                )}
                disabled={!pagination || pagination.pageIndex === 0}
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </Button>
              
              {pageCount && pagination ? Array.from({ length: Math.min(5, pageCount) }).map((_, i) => {
                let pageNum: number;
                
                if (pageCount <= 5) {
                  pageNum = i;
                } else if (pagination.pageIndex < 2) {
                  pageNum = i;
                } else if (pagination.pageIndex > pageCount - 3) {
                  pageNum = pageCount - 5 + i;
                } else {
                  pageNum = pagination.pageIndex - 2 + i;
                }
                
                if (pageNum >= 0 && pageNum < pageCount) {
                  const isCurrentPage = pageNum === pagination.pageIndex;
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={isCurrentPage ? "default" : "outline"}
                      size="icon"
                      className={`relative inline-flex items-center px-4 py-2 border ${
                        isCurrentPage 
                          ? "border-primary bg-primary text-white" 
                          : "border-neutral-300 bg-white text-text-primary"
                      } text-sm font-medium hover:bg-neutral-50`}
                      onClick={() => onPaginationChange?.(pageNum, pagination.pageSize)}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                }
                
                return null;
              }) : null}
              
              <Button
                variant="outline"
                size="icon"
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-neutral-300 bg-white text-sm font-medium text-text-primary hover:bg-neutral-50"
                onClick={() => onPaginationChange?.(
                  Math.min((pageCount || 0) - 1, (pagination?.pageIndex || 0) + 1),
                  pagination?.pageSize || 10
                )}
                disabled={!pagination || pagination.pageIndex === (pageCount || 0) - 1}
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
