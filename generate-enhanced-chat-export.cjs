const XLSX = require('xlsx');
const { Pool } = require('pg');
const sql = require('mssql');

// Azure SQL configuration
const azureConfig = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  database: process.env.AZURE_SQL_DATABASE,
  server: process.env.AZURE_SQL_SERVER,
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

async function generateEnhancedChatExport() {
  let postgresPool;
  let azurePool;
  
  try {
    console.log('🔄 Connecting to databases...');
    
    // Connect to PostgreSQL for chat messages
    postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
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
      SELECT DISTINCT
        ROW_NUMBER() OVER (ORDER BY ZohoID) as id,
        ZohoID,
        FullName,
        Department,
        BusinessUnit,
        ClientSecurity
      FROM [MergedEmployeeData]
      WHERE ZohoID IS NOT NULL
      ORDER BY ZohoID
    `;
    
    const employeeRequest = azurePool.request();
    const employeeResult = await employeeRequest.query(employeeQuery);
    const employees = employeeResult.recordset;
    
    console.log(`✅ Found ${employees.length} employees in Azure SQL`);
    
    // Create employee lookup map (employee_id -> employee details)
    const employeeMap = new Map();
    employees.forEach((emp, index) => {
      employeeMap.set(index + 1, {
        zohoId: emp.ZohoID,
        fullName: emp.FullName,
        department: emp.Department,
        businessUnit: emp.BusinessUnit,
        clientSecurity: emp.ClientSecurity
      });
    });
    
    // Combine chat messages with employee data for "All Chat Messages" tab
    console.log('🔄 Creating enhanced Excel data...');
    const allChatMessagesData = chatMessages.map(chat => {
      const employee = employeeMap.get(chat.employee_id) || {
        zohoId: 'N/A',
        fullName: 'Employee Not Found',
        department: 'N/A',
        businessUnit: 'N/A',
        clientSecurity: 'N/A'
      };
      
      return {
        'Chat ID': chat.chat_id,
        'Employee ID (Internal)': chat.employee_id,
        'ZOHO ID': employee.zohoId,
        'Employee Name': employee.fullName,
        'Department': employee.department,
        'Business Unit': employee.businessUnit,
        'Client/Security': employee.clientSecurity,
        'Chat Entered By': chat.chat_entered_by,
        'Chat Content': chat.chat_content,
        'Chat Entered Date/Time': new Date(chat.chat_entered_datetime).toLocaleString(),
        'Content Length': chat.chat_content.length
      };
    });
    
    console.log('🔄 Creating Excel workbook...');
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: All Chat Messages (with ZOHO ID and Employee Name)
    const allChatWorksheet = XLSX.utils.json_to_sheet(allChatMessagesData);
    
    // Set column widths for All Chat Messages
    const allChatColumnWidths = [
      { wch: 10 }, // Chat ID
      { wch: 15 }, // Employee ID (Internal)
      { wch: 15 }, // ZOHO ID
      { wch: 30 }, // Employee Name
      { wch: 20 }, // Department
      { wch: 20 }, // Business Unit
      { wch: 20 }, // Client/Security
      { wch: 25 }, // Chat Entered By
      { wch: 60 }, // Chat Content
      { wch: 20 }, // Chat Entered Date/Time
      { wch: 12 }  // Content Length
    ];
    
    allChatWorksheet['!cols'] = allChatColumnWidths;
    XLSX.utils.book_append_sheet(workbook, allChatWorksheet, 'All Chat Messages');
    
    // Sheet 2: Employee Analysis (with chat message counts)
    const employeeAnalysis = employees.map((emp, index) => {
      const empId = index + 1;
      const empChatMessages = chatMessages.filter(chat => chat.employee_id === empId);
      return {
        'Employee ID (Internal)': empId,
        'ZOHO ID': emp.ZohoID,
        'Employee Name': emp.FullName,
        'Department': emp.Department,
        'Business Unit': emp.BusinessUnit,
        'Client/Security': emp.ClientSecurity,
        'Total Chat Messages': empChatMessages.length,
        'Has Chat Feedback': empChatMessages.length > 0 ? 'Yes' : 'No',
        'Last Chat Date': empChatMessages.length > 0 ? 
          new Date(Math.max(...empChatMessages.map(m => new Date(m.chat_entered_datetime).getTime()))).toLocaleDateString() : 
          'No Messages'
      };
    });
    
    const employeeWorksheet = XLSX.utils.json_to_sheet(employeeAnalysis);
    employeeWorksheet['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, 
      { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(workbook, employeeWorksheet, 'Employee Analysis');

    // Sheet 3: Summary Statistics
    const summaryData = [
      { 'Metric': 'Total Chat Messages', 'Value': chatMessages.length },
      { 'Metric': 'Total Employees in Database', 'Value': employees.length },
      { 'Metric': 'Employees with Chat Feedback', 'Value': new Set(chatMessages.map(m => m.employee_id)).size },
      { 'Metric': 'Coverage Percentage', 'Value': `${((new Set(chatMessages.map(m => m.employee_id)).size / employees.length) * 100).toFixed(1)}%` },
      { 'Metric': 'Unique Chat Contributors', 'Value': new Set(chatMessages.map(m => m.chat_entered_by)).size },
      { 'Metric': 'Average Messages per Employee', 'Value': (chatMessages.length / new Set(chatMessages.map(m => m.employee_id)).size).toFixed(1) },
      { 'Metric': 'Date Range', 'Value': 'June 2025 - July 2025' },
      { 'Metric': 'Analysis Generated', 'Value': new Date().toISOString().split('T')[0] }
    ];
    
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary Statistics');

    // Sheet 4: Missing Chat Data Analysis
    const employeesWithoutChat = employees.filter((emp, index) => {
      const empId = index + 1;
      return !chatMessages.some(chat => chat.employee_id === empId);
    }).map((emp, index) => ({
      'Employee ID (Internal)': employees.indexOf(emp) + 1,
      'ZOHO ID': emp.ZohoID,
      'Employee Name': emp.FullName,
      'Department': emp.Department,
      'Business Unit': emp.BusinessUnit,
      'Client/Security': emp.ClientSecurity,
      'Status': 'Missing Chat Data'
    }));

    const missingDataWorksheet = XLSX.utils.json_to_sheet(employeesWithoutChat);
    missingDataWorksheet['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, 
      { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, missingDataWorksheet, 'Missing Chat Data');
    
    // Save Excel file (with consistent naming)
    const filename = 'Chat_Messages_Export_2025-07-06.xlsx';
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Excel file created successfully: ${filename}`);
    console.log(`📊 Report contains ${chatMessages.length} chat messages across ${new Set(chatMessages.map(m => m.employee_id)).size} employees`);
    console.log(`📋 All Chat Messages tab now includes ZOHO ID and Employee Name columns`);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Error generating Excel file:', error);
    throw error;
  } finally {
    // Close database connections
    if (postgresPool) {
      await postgresPool.end();
    }
  }
}

// Run the script
generateEnhancedChatExport()
  .then(filename => {
    console.log(`🎉 Enhanced chat analysis Excel file generated: ${filename}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to generate Excel file:', error);
    process.exit(1);
  });