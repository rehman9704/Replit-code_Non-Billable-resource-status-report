const XLSX = require('xlsx');
const { Pool } = require('pg');
const sql = require('mssql');

// Azure SQL Server configuration
const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// PostgreSQL configuration
const postgresConfig = {
  connectionString: process.env.DATABASE_URL
};

async function generateCorrectedChatReports() {
  let postgresPool;
  let azurePool;
  
  try {
    console.log('🔄 Connecting to databases...');
    
    // Connect to PostgreSQL for chat messages
    postgresPool = new Pool(postgresConfig);
    console.log('✅ Connected to PostgreSQL successfully');
    
    // Connect to Azure SQL Server for employee data with correct Zoho IDs
    azurePool = await sql.connect(azureConfig);
    console.log('✅ Connected to Azure SQL Server successfully');
    
    // Get employee data from Azure SQL Server with correct Zoho IDs
    console.log('🔄 Fetching employee data from Azure SQL Server...');
    const employeeQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id,
        ZohoID,
        FullName,
        Department,
        BusinessUnit,
        Location,
        Employeestatus,
        Role,
        Designation,
        EmailID,
        ReportingTo_Name,
        Level1_ProjectManager,
        Level2_DepartmentHead
      FROM RC_BI_Database.dbo.zoho_Employee 
      WHERE ZohoID IS NOT NULL 
        AND FullName IS NOT NULL
        AND LTRIM(RTRIM(ZohoID)) != ''
        AND LTRIM(RTRIM(FullName)) != ''
      ORDER BY ZohoID
    `;
    
    const employeeResult = await azurePool.request().query(employeeQuery);
    const employees = employeeResult.recordset;
    console.log(`✅ Found ${employees.length} employees from Azure SQL Server`);
    
    // Create a mapping from internal_id to employee data
    const employeeMap = new Map();
    employees.forEach((emp, index) => {
      // Map by index + 1 to match the internal_id system (1-based)
      employeeMap.set(index + 1, emp);
    });
    
    // Get chat messages from PostgreSQL
    console.log('🔄 Fetching chat messages from PostgreSQL...');
    const chatQuery = `
      SELECT 
        cm.id as chat_id,
        cm.employee_id as internal_employee_id,
        cm.sender as chat_entered_by,
        cm.content as chat_content,
        cm.timestamp as chat_entered_datetime,
        DATE(cm.timestamp) as chat_date,
        TO_CHAR(cm.timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_datetime,
        LENGTH(cm.content) as content_length
      FROM chat_messages cm
      ORDER BY cm.employee_id, cm.timestamp
    `;
    
    const chatResult = await postgresPool.query(chatQuery);
    const chatMessages = chatResult.rows;
    console.log(`✅ Found ${chatMessages.length} chat messages from PostgreSQL`);
    
    // ============ REPORT 1: Employee Chat Analysis Report ============
    console.log('📊 Generating Employee Chat Analysis Report...');
    
    const analysisData = chatMessages.map(chat => {
      const employee = employeeMap.get(chat.internal_employee_id);
      
      return {
        'Chat ID': chat.chat_id,
        'Internal Employee ID': chat.internal_employee_id,
        'Zoho ID': employee ? employee.ZohoID : `UNKNOWN_${chat.internal_employee_id}`,
        'Employee Name': employee ? employee.FullName : `Unknown Employee ${chat.internal_employee_id}`,
        'Department': employee ? employee.Department : 'Unknown',
        'Business Unit': employee ? employee.BusinessUnit : 'Unknown',
        'Location': employee ? employee.Location : 'Unknown',
        'Status': employee ? employee.Employeestatus : 'Unknown',
        'Role': employee ? employee.Role : 'Unknown',
        'Designation': employee ? employee.Designation : 'Unknown',
        'Email': employee ? employee.EmailID : 'Unknown',
        'Reporting To': employee ? employee.ReportingTo_Name : 'Unknown',
        'Project Manager': employee ? employee.Level1_ProjectManager : 'Unknown',
        'Department Head': employee ? employee.Level2_DepartmentHead : 'Unknown',
        'Chat Entered By': chat.chat_entered_by,
        'Chat Content': chat.chat_content,
        'Content Length': chat.content_length,
        'Chat Date': chat.chat_date,
        'Chat DateTime': chat.formatted_datetime,
        'Data Source': 'Azure SQL + PostgreSQL'
      };
    });
    
    const analysisWorkbook = XLSX.utils.book_new();
    const analysisWorksheet = XLSX.utils.json_to_sheet(analysisData);
    
    // Set column widths for better readability
    const analysisColWidths = [
      { wch: 10 },  // Chat ID
      { wch: 15 },  // Internal Employee ID
      { wch: 12 },  // Zoho ID
      { wch: 25 },  // Employee Name
      { wch: 20 },  // Department
      { wch: 20 },  // Business Unit
      { wch: 15 },  // Location
      { wch: 12 },  // Status
      { wch: 20 },  // Role
      { wch: 20 },  // Designation
      { wch: 25 },  // Email
      { wch: 25 },  // Reporting To
      { wch: 25 },  // Project Manager
      { wch: 25 },  // Department Head
      { wch: 20 },  // Chat Entered By
      { wch: 50 },  // Chat Content
      { wch: 12 },  // Content Length
      { wch: 12 },  // Chat Date
      { wch: 20 },  // Chat DateTime
      { wch: 20 }   // Data Source
    ];
    analysisWorksheet['!cols'] = analysisColWidths;
    
    XLSX.utils.book_append_sheet(analysisWorkbook, analysisWorksheet, 'Employee Chat Analysis');
    
    const analysisFilename = 'Employee_Chat_Analysis_Report_CORRECTED_2025-07-06.xlsx';
    XLSX.writeFile(analysisWorkbook, analysisFilename);
    console.log(`✅ Generated: ${analysisFilename}`);
    
    // ============ REPORT 2: Zoho ID Chat Mapping Report ============
    console.log('📊 Generating Zoho ID Chat Mapping Report...');
    
    // Group chat messages by employee
    const employeeChatMap = new Map();
    chatMessages.forEach(chat => {
      if (!employeeChatMap.has(chat.internal_employee_id)) {
        employeeChatMap.set(chat.internal_employee_id, []);
      }
      employeeChatMap.get(chat.internal_employee_id).push(chat);
    });
    
    const mappingData = [];
    employeeChatMap.forEach((chats, internalId) => {
      const employee = employeeMap.get(internalId);
      const latestChat = chats[chats.length - 1]; // Get most recent chat
      
      mappingData.push({
        'Internal Employee ID': internalId,
        'Correct Zoho ID': employee ? employee.ZohoID : `UNKNOWN_${internalId}`,
        'Employee Name': employee ? employee.FullName : `Unknown Employee ${internalId}`,
        'Department': employee ? employee.Department : 'Unknown',
        'Business Unit': employee ? employee.BusinessUnit : 'Unknown',
        'Location': employee ? employee.Location : 'Unknown',
        'Status': employee ? employee.Employeestatus : 'Unknown',
        'Role': employee ? employee.Role : 'Unknown',
        'Email': employee ? employee.EmailID : 'Unknown',
        'Total Chat Messages': chats.length,
        'Latest Chat Date': latestChat.chat_date,
        'Latest Chat Content': latestChat.chat_content.substring(0, 100) + '...',
        'Chat Date Range': `${chats[0].chat_date} to ${latestChat.chat_date}`,
        'Data Source': employee ? 'Azure SQL Server' : 'PostgreSQL Only',
        'Mapping Status': employee ? 'MAPPED' : 'UNMAPPED'
      });
    });
    
    // Sort by Zoho ID
    mappingData.sort((a, b) => {
      const aZoho = a['Correct Zoho ID'].toString();
      const bZoho = b['Correct Zoho ID'].toString();
      return aZoho.localeCompare(bZoho);
    });
    
    const mappingWorkbook = XLSX.utils.book_new();
    const mappingWorksheet = XLSX.utils.json_to_sheet(mappingData);
    
    // Set column widths
    const mappingColWidths = [
      { wch: 15 },  // Internal Employee ID
      { wch: 15 },  // Correct Zoho ID
      { wch: 25 },  // Employee Name
      { wch: 20 },  // Department
      { wch: 20 },  // Business Unit
      { wch: 15 },  // Location
      { wch: 12 },  // Status
      { wch: 20 },  // Role
      { wch: 25 },  // Email
      { wch: 15 },  // Total Chat Messages
      { wch: 15 },  // Latest Chat Date
      { wch: 40 },  // Latest Chat Content
      { wch: 25 },  // Chat Date Range
      { wch: 20 },  // Data Source
      { wch: 15 }   // Mapping Status
    ];
    mappingWorksheet['!cols'] = mappingColWidths;
    
    XLSX.utils.book_append_sheet(mappingWorkbook, mappingWorksheet, 'Zoho ID Chat Mapping');
    
    const mappingFilename = 'Zoho_ID_Chat_Mapping_Report_CORRECTED_2025-07-06.xlsx';
    XLSX.writeFile(mappingWorkbook, mappingFilename);
    console.log(`✅ Generated: ${mappingFilename}`);
    
    // ============ SUMMARY ============
    console.log('\n📋 CORRECTED REPORTS SUMMARY:');
    console.log(`🔍 Total Employees in Azure SQL: ${employees.length}`);
    console.log(`💬 Total Chat Messages in PostgreSQL: ${chatMessages.length}`);
    console.log(`👥 Employees with Chat Messages: ${employeeChatMap.size}`);
    
    const mappedEmployees = mappingData.filter(emp => emp['Mapping Status'] === 'MAPPED').length;
    const unmappedEmployees = mappingData.filter(emp => emp['Mapping Status'] === 'UNMAPPED').length;
    
    console.log(`✅ Successfully Mapped: ${mappedEmployees} employees`);
    console.log(`❌ Unmapped (Missing from Azure): ${unmappedEmployees} employees`);
    console.log(`📊 Data Source: Azure SQL Server + PostgreSQL`);
    console.log(`📁 Files Generated:`);
    console.log(`   • ${analysisFilename}`);
    console.log(`   • ${mappingFilename}`);
    
  } catch (error) {
    console.error('❌ Error generating corrected reports:', error);
    throw error;
  } finally {
    // Close connections
    if (postgresPool) {
      await postgresPool.end();
      console.log('🔌 PostgreSQL connection closed');
    }
    if (azurePool) {
      await azurePool.close();
      console.log('🔌 Azure SQL Server connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  generateCorrectedChatReports()
    .then(() => {
      console.log('✅ Corrected chat reports generation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to generate corrected reports:', error);
      process.exit(1);
    });
}

module.exports = { generateCorrectedChatReports };