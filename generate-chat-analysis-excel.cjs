const XLSX = require('xlsx');
const { Pool } = require('pg');
const sql = require('mssql');

// Database configurations
const postgresConfig = {
  connectionString: process.env.DATABASE_URL
};

const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
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
    
    // Get employee data from Azure SQL
    console.log('🔄 Fetching employee data from Azure SQL...');
    const employeeQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ZohoID) as id,
        ZohoID,
        FullName,
        Department,
        BusinessUnit
      FROM RC_BI_Database.dbo.zoho_Employee
      WHERE ZohoID IS NOT NULL
      ORDER BY ZohoID
    `;
    
    const employeeRequest = azurePool.request();
    const employeeResult = await employeeRequest.query(employeeQuery);
    const employees = employeeResult.recordset;
    
    console.log(`✅ Found ${employees.length} employees in Azure SQL`);
    
    // Create Zoho ID to employee details mapping
    const zohoToEmployeeMap = new Map();
    employees.forEach(emp => {
      zohoToEmployeeMap.set(emp.ZohoID, {
        zohoId: emp.ZohoID,
        fullName: emp.FullName,
        department: emp.Department,
        businessUnit: emp.BusinessUnit,
        clientSecurity: emp.ClientSecurity,
        internalId: emp.id
      });
    });
    
    // Create mapping from PostgreSQL employee_id to Azure SQL data
    // First, get the mapping from our storage layer
    console.log('🔄 Creating employee ID mapping...');
    const employeeIdToZohoMap = new Map();
    
    // Query the current employee mapping from storage to get internal ID to Zoho ID mapping
    const mappingQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id,
        ZohoID
      FROM RC_BI_Database.dbo.zoho_Employee
      WHERE ZohoID IS NOT NULL
      ORDER BY ZohoID
    `;
    
    const mappingRequest = azurePool.request();
    const mappingResult = await mappingRequest.query(mappingQuery);
    
    // Create the mapping: PostgreSQL employee_id -> Azure Zoho ID
    mappingResult.recordset.forEach(row => {
      employeeIdToZohoMap.set(row.internal_id, row.ZohoID);
    });
    
    console.log(`✅ Created mapping for ${employeeIdToZohoMap.size} employee IDs`);
    
    // Combine chat messages with employee data
    console.log('🔄 Creating comprehensive Excel data...');
    const excelData = chatMessages.map(chat => {
      // Get Zoho ID from the mapping
      const zohoId = employeeIdToZohoMap.get(chat.employee_id);
      // Get employee details from Azure SQL using Zoho ID
      const employee = zohoId ? zohoToEmployeeMap.get(zohoId) : null;
      
      const employeeData = employee || {
        zohoId: 'N/A',
        fullName: 'Employee Not Found',
        department: 'N/A',
        businessUnit: 'N/A',
        clientSecurity: 'N/A'
      };
      
      return {
        'Chat ID': chat.chat_id,
        'Employee ID (Internal)': chat.employee_id,
        'Zoho ID': employeeData.zohoId,
        'Employee Name': employeeData.fullName,
        'Department': employeeData.department,
        'Business Unit': employeeData.businessUnit,
        'Client/Security': employeeData.clientSecurity,
        'Chat Entered By': chat.chat_entered_by,
        'Chat Content': chat.chat_content,
        'Chat Entered Date/Time': chat.chat_entered_datetime,
        'Status': 'Active'
      };
    });
    
    console.log('🔄 Creating Excel workbook...');
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 10 }, // Chat ID
      { wch: 15 }, // Employee ID (Internal)
      { wch: 12 }, // Zoho ID
      { wch: 25 }, // Employee Name
      { wch: 20 }, // Department
      { wch: 20 }, // Business Unit
      { wch: 20 }, // Client/Security
      { wch: 25 }, // Chat Entered By
      { wch: 50 }, // Chat Content
      { wch: 20 }, // Chat Entered Date/Time
      { wch: 10 }  // Status
    ];
    
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chat Analysis');
    
    // Create summary worksheet
    const summaryData = [
      { 'Metric': 'Total Chat Messages', 'Value': chatMessages.length },
      { 'Metric': 'Unique Employees with Comments', 'Value': new Set(chatMessages.map(m => m.employee_id)).size },
      { 'Metric': 'Unique Chat Contributors', 'Value': new Set(chatMessages.map(m => m.chat_entered_by)).size },
      { 'Metric': 'Date Range', 'Value': 'June 2025 - July 2025' },
      { 'Metric': 'Analysis Generated', 'Value': new Date().toISOString().split('T')[0] }
    ];
    
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    
    // Save Excel file
    const filename = `Chat_Analysis_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Excel file created successfully: ${filename}`);
    console.log(`📊 Report contains ${chatMessages.length} chat messages across ${new Set(chatMessages.map(m => m.employee_id)).size} employees`);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Error generating Excel file:', error);
    throw error;
  } finally {
    // Close database connections
    if (postgresPool) {
      await postgresPool.end();
    }
    if (azurePool) {
      await azurePool.close();
    }
  }
}

// Run the script
generateChatAnalysisExcel()
  .then(filename => {
    console.log(`🎉 Chat analysis Excel file generated: ${filename}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to generate Excel file:', error);
    process.exit(1);
  });