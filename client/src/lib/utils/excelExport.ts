import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Employee } from '@shared/schema';

export function exportToExcel(employees: Employee[], filename: string = 'Non_Billable_Resource_Status_Report') {
  // Prepare data for Excel export
  const excelData = employees.map((employee, index) => ({
    'Employee Number': employee.zohoId,
    'Employee Name': employee.name,
    'Job Type': 'Permanent', // Default as shown in Power BI
    'Location': 'Karachi', // Default as shown in Power BI
    'Cost (USD)': employee.cost?.replace('$', '').replace(',', '') || '0',
    'Department': employee.department,
    'Client': employee.client,
    'Project': employee.project,
    'Billable Status': employee.billableStatus,
    'Last Month Non Billable Hours': employee.lastMonthNonBillableHours || '0',
    'Last Month Billable Hours': employee.lastMonthBillableHours || '0'
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for better readability
  const colWidths = [
    { wch: 15 }, // Employee Number
    { wch: 25 }, // Employee Name
    { wch: 12 }, // Job Type
    { wch: 10 }, // Location
    { wch: 12 }, // Cost (USD)
    { wch: 20 }, // Department
    { wch: 20 }, // Client
    { wch: 20 }, // Project
    { wch: 18 }, // Billable Status
    { wch: 20 }, // Last Month Non Billable Hours
    { wch: 20 }  // Last Month Billable Hours
  ];
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Non Billable Resources');

  // Generate Excel file and download
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Create filename with current date
  const currentDate = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename}_${currentDate}.xlsx`;
  
  saveAs(blob, finalFilename);
}