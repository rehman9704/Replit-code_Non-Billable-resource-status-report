const XLSX = require('xlsx');
const { Pool } = require('pg');
const sql = require('mssql');

// Database configurations using actual connection details
const postgresConfig = {
  connectionString: process.env.DATABASE_URL
};

const azureConfig = {
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  database: 'RC_BI_Database',
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 300000,
    connectionTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function generateChatAnalysisExcel() {
  let postgresPool;
  let azurePool;
  
  try {
    console.log('🔄 Connecting to databases...');
    
    // Connect to PostgreSQL for chat messages
    postgresPool = new Pool(postgresConfig);
    
    // Connect to Azure SQL for employee data
    azurePool = new sql.ConnectionPool(azureConfig);
    await azurePool.connect();
    
    console.log('✅ Connected to both databases successfully');
    
    // Get chat messages from PostgreSQL
    console.log('🔄 Fetching chat messages from PostgreSQL...');
    const chatQuery = `
      SELECT 
        cm.id as chat_id,
        cm.employee_id,
        cm.sender as chat_entered_by,
        cm.content as chat_content,
        cm.timestamp as chat_entered_datetime
      FROM chat_messages cm
      ORDER BY cm.employee_id, cm.timestamp
    `;
    
    const chatResult = await postgresPool.query(chatQuery);
    const chatMessages = chatResult.rows;
    
    console.log(`✅ Found ${chatMessages.length} chat messages`);
    
    // Get employee data from Azure SQL using the exact query structure from storage.ts
    console.log('🔄 Fetching employee data from Azure SQL...');
    const employeeQuery = `
      WITH MergedData AS (
        SELECT 
          a.ZohoID AS Employee_Number,
          a.FullName AS Employee_Name,
          a.Department,
          a.BillableStatus,
          a.BusinessUnit,
          a.ClientSecurity,
          a.Project,
          a.LastMonthBillable,
          a.LastMonthBillableHours,
          a.LastMonthNonBillableHours,
          a.Cost,
          a.Comments,
          a.TimesheetAging,
          a.Location,
          ROW_NUMBER() OVER (ORDER BY a.ZohoID) as id
        FROM [RC_BI_Database].[dbo].[MergedEmployeeData] a
        WHERE a.ZohoID IS NOT NULL
      )
      SELECT * FROM MergedData
      ORDER BY Employee_Number
    `;
    
    const employeeRequest = azurePool.request();
    const employeeResult = await employeeRequest.query(employeeQuery);
    const employees = employeeResult.recordset;
    
    console.log(`✅ Found ${employees.length} employees in Azure SQL`);
    
    // Create employee lookup map (internal id -> employee details)
    const employeeMap = new Map();
    employees.forEach((emp) => {
      employeeMap.set(emp.id, {
        zohoId: emp.Employee_Number,
        fullName: emp.Employee_Name,
        department: emp.Department,
        businessUnit: emp.BusinessUnit,
        clientSecurity: emp.ClientSecurity,
        project: emp.Project,
        billableStatus: emp.BillableStatus
      });
    });
    
    console.log('🔄 Creating comprehensive Excel data...');
    
    // Combine chat messages with employee data
    const excelData = chatMessages.map(chat => {
      const employee = employeeMap.get(chat.employee_id) || {
        zohoId: 'N/A',
        fullName: `Employee ID ${chat.employee_id} Not Found`,
        department: 'N/A',
        businessUnit: 'N/A',
        clientSecurity: 'N/A',
        project: 'N/A',
        billableStatus: 'N/A'
      };
      
      return {
        'Chat ID': chat.chat_id,
        'Employee ID (Internal)': chat.employee_id,
        'Zoho ID': employee.zohoId,
        'Employee Name': employee.fullName,
        'Department': employee.department,
        'Business Unit': employee.businessUnit,
        'Client/Security': employee.clientSecurity,
        'Project': employee.project,
        'Billable Status': employee.billableStatus,
        'Chat Entered By': chat.chat_entered_by,
        'Chat Content': chat.chat_content,
        'Chat Entered Date/Time': new Date(chat.chat_entered_datetime).toLocaleString(),
        'Status': 'Active',
        'Mapping Issue': employee.zohoId === 'N/A' ? 'YES - Employee not found in Azure SQL' : 'NO - Properly mapped'
      };
    });
    
    // Create workbook with detailed analysis
    console.log('🔄 Creating Excel workbook...');
    const workbook = XLSX.utils.book_new();
    
    // Main chat data sheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chat Analysis');
    
    // Summary statistics sheet
    const totalMessages = chatMessages.length;
    const uniqueEmployeesWithChats = new Set(chatMessages.map(c => c.employee_id)).size;
    const totalEmployeesInAzure = employees.length;
    const orphanedMessages = excelData.filter(row => row['Mapping Issue'].includes('YES')).length;
    const properlyMappedMessages = totalMessages - orphanedMessages;
    
    const summaryData = [
      { Metric: 'Total Chat Messages', Value: totalMessages },
      { Metric: 'Unique Employees with Chat Messages', Value: uniqueEmployeesWithChats },
      { Metric: 'Total Employees in Azure SQL', Value: totalEmployeesInAzure },
      { Metric: 'Properly Mapped Messages', Value: properlyMappedMessages },
      { Metric: 'Orphaned Messages (No Employee Match)', Value: orphanedMessages },
      { Metric: 'Mapping Success Rate', Value: `${((properlyMappedMessages / totalMessages) * 100).toFixed(1)}%` },
      { Metric: 'Report Generated', Value: new Date().toLocaleString() }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Employee ID mapping sheet for debugging
    const employeeList = Array.from(employeeMap.entries()).map(([internalId, emp]) => ({
      'Internal ID': internalId,
      'Zoho ID': emp.zohoId,
      'Employee Name': emp.fullName,
      'Department': emp.department,
      'Business Unit': emp.businessUnit,
      'Has Chat Messages': chatMessages.some(chat => chat.employee_id === internalId) ? 'YES' : 'NO'
    }));
    
    const employeeSheet = XLSX.utils.json_to_sheet(employeeList);
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employee Mapping');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Employee_Chat_Analysis_Report_${timestamp}_DETAILED.xlsx`;
    
    // Write file
    XLSX.writeFile(workbook, filename);
    
    console.log('✅ Excel file generated successfully!');
    console.log(`📊 Report Summary:`);
    console.log(`   Total Messages: ${totalMessages}`);
    console.log(`   Employees with Messages: ${uniqueEmployeesWithChats}`);
    console.log(`   Total Employees in System: ${totalEmployeesInAzure}`);
    console.log(`   Properly Mapped: ${properlyMappedMessages} (${((properlyMappedMessages / totalMessages) * 100).toFixed(1)}%)`);
    console.log(`   Orphaned Messages: ${orphanedMessages}`);
    console.log(`📁 File saved as: ${filename}`);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Error generating Excel file:', error);
    throw error;
  } finally {
    // Close connections
    if (postgresPool) {
      await postgresPool.end();
    }
    if (azurePool) {
      await azurePool.close();
    }
  }
}

// Run the export
generateChatAnalysisExcel()
  .then(filename => {
    console.log(`🎉 Export completed successfully: ${filename}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to generate Excel file:', error);
    process.exit(1);
  });