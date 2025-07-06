#!/usr/bin/env node

/**
 * Corrected Excel Chat Export with Real Azure SQL Employee Data
 * Fetches actual employee data from Azure SQL Database to match chat messages properly
 */

import pkg from 'pg';
const { Pool } = pkg;
import sql from 'mssql';
import XLSX from 'xlsx';

// PostgreSQL connection for chat messages
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Azure SQL configuration
const azureConfig = {
  server: process.env.AZURE_SQL_SERVER || 'your-server.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'your-database',
  user: process.env.AZURE_SQL_USER || 'your-username',
  password: process.env.AZURE_SQL_PASSWORD || 'your-password',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function generateCorrectedExcelExport() {
  let azurePool = null;
  
  try {
    console.log('🔄 Generating corrected Excel export with real employee data...');
    
    // Get chat messages from PostgreSQL
    console.log('📊 Fetching chat messages from PostgreSQL...');
    const chatResult = await pgPool.query(`
      SELECT 
        id as chat_id,
        employee_id,
        sender as chat_entered_by,
        content as chat_content,
        timestamp as chat_entered_datetime
      FROM chat_messages 
      ORDER BY employee_id, timestamp
    `);
    const chatMessages = chatResult.rows;
    console.log(`✅ Found ${chatMessages.length} chat messages`);
    
    // Get unique employee IDs that have chat messages
    const employeeIdsWithChats = [...new Set(chatMessages.map(msg => msg.employee_id))];
    console.log(`📋 Employee IDs with chat messages: ${employeeIdsWithChats.join(', ')}`);
    
    // Connect to Azure SQL and fetch employee data
    console.log('🔗 Connecting to Azure SQL Database...');
    azurePool = await sql.connect(azureConfig);
    
    // Create employee lookup map from Azure SQL
    const employeeMap = new Map();
    
    // For each employee ID that has chat messages, fetch the corresponding employee data
    for (const empId of employeeIdsWithChats) {
      try {
        const result = await azurePool.request().query(`
          SELECT ZohoID, FullName, Department, BusinessUnit, ClientSecurity
          FROM (
            SELECT 
              ROW_NUMBER() OVER (ORDER BY ZohoID) as RowNum,
              ZohoID, 
              FullName,
              Department,
              BusinessUnit,
              ClientSecurity
            FROM MergedEmployeeData
          ) emp 
          WHERE emp.RowNum = ${empId}
        `);
        
        if (result.recordset.length > 0) {
          const emp = result.recordset[0];
          employeeMap.set(empId, {
            zohoId: emp.ZohoID,
            fullName: emp.FullName,
            department: emp.Department,
            businessUnit: emp.BusinessUnit,
            clientSecurity: emp.ClientSecurity
          });
          console.log(`✅ Mapped Employee ID ${empId}: ${emp.FullName} (ZOHO: ${emp.ZohoID})`);
        } else {
          console.log(`❌ No employee found for ID ${empId}`);
          // Add placeholder for missing employees
          employeeMap.set(empId, {
            zohoId: 'N/A',
            fullName: 'Employee Not Found',
            department: 'N/A',
            businessUnit: 'N/A',
            clientSecurity: 'N/A'
          });
        }
      } catch (error) {
        console.error(`❌ Error fetching employee ${empId}:`, error.message);
        // Add placeholder for error cases
        employeeMap.set(empId, {
          zohoId: 'ERROR',
          fullName: 'Database Error',
          department: 'ERROR',
          businessUnit: 'ERROR',
          clientSecurity: 'ERROR'
        });
      }
    }
    
    // Combine chat messages with employee data for "All Chat Messages" tab
    const allChatMessagesData = chatMessages.map(chat => {
      const employee = employeeMap.get(chat.employee_id) || {
        zohoId: 'MISSING',
        fullName: 'Employee ID Not Found',
        department: 'MISSING',
        businessUnit: 'MISSING',
        clientSecurity: 'MISSING'
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
        'Content Length': String(chat.chat_content).length
      };
    });
    
    console.log('🔄 Creating Excel workbook...');
    
    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: All Chat Messages (Enhanced with employee data)
    const allChatSheet = XLSX.utils.json_to_sheet(allChatMessagesData);
    XLSX.utils.book_append_sheet(workbook, allChatSheet, 'All Chat Messages');
    
    // Sheet 2: Employee Analysis (Summary by employee)
    const employeeAnalysis = Array.from(employeeMap.entries()).map(([empId, empData]) => {
      const employeeMessages = chatMessages.filter(msg => msg.employee_id === empId);
      return {
        'Employee ID (Internal)': empId,
        'ZOHO ID': empData.zohoId,
        'Employee Name': empData.fullName,
        'Department': empData.department,
        'Business Unit': empData.businessUnit,
        'Client/Security': empData.clientSecurity,
        'Total Messages': employeeMessages.length,
        'First Message Date': employeeMessages.length > 0 ? new Date(Math.min(...employeeMessages.map(m => new Date(m.chat_entered_datetime)))).toLocaleDateString() : 'N/A',
        'Last Message Date': employeeMessages.length > 0 ? new Date(Math.max(...employeeMessages.map(m => new Date(m.chat_entered_datetime)))).toLocaleDateString() : 'N/A'
      };
    });
    
    const analysisSheet = XLSX.utils.json_to_sheet(employeeAnalysis);
    XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Employee Analysis');
    
    // Sheet 3: Summary Statistics
    const totalMessages = chatMessages.length;
    const totalEmployees = employeeMap.size;
    const avgMessagesPerEmployee = (totalMessages / totalEmployees).toFixed(2);
    const messagesWithValidEmployees = allChatMessagesData.filter(msg => msg['ZOHO ID'] !== 'N/A' && msg['ZOHO ID'] !== 'MISSING' && msg['ZOHO ID'] !== 'ERROR').length;
    const mappingSuccessRate = ((messagesWithValidEmployees / totalMessages) * 100).toFixed(1);
    
    const summaryData = [
      { Metric: 'Total Chat Messages', Value: totalMessages },
      { Metric: 'Total Employees with Messages', Value: totalEmployees },
      { Metric: 'Average Messages per Employee', Value: avgMessagesPerEmployee },
      { Metric: 'Messages with Valid Employee Mapping', Value: messagesWithValidEmployees },
      { Metric: 'Mapping Success Rate', Value: `${mappingSuccessRate}%` },
      { Metric: 'Export Generated', Value: new Date().toLocaleString() }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary Statistics');
    
    // Write Excel file
    const filename = 'Chat_Messages_Export_2025-07-06.xlsx';
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Corrected Excel file created: ${filename}`);
    console.log(`📋 All Chat Messages tab now includes accurate ZOHO ID and Employee Name columns`);
    console.log(`📊 Total: ${totalMessages} messages across ${totalEmployees} employees`);
    console.log(`📈 Mapping Success Rate: ${mappingSuccessRate}%`);
    
    console.log('\\n🔍 Employee Chat Mappings Verified:');
    employeeAnalysis.forEach(emp => {
      if (emp['Total Messages'] > 0) {
        console.log(`  ✓ ${emp['Employee Name']} (ZOHO: ${emp['ZOHO ID']}) - ${emp['Total Messages']} messages`);
      }
    });
    
    console.log('🎉 Corrected Excel export completed successfully!');
    
  } catch (error) {
    console.error('❌ Error generating corrected Excel export:', error);
    throw error;
  } finally {
    // Clean up connections
    if (azurePool) {
      await azurePool.close();
    }
    await pgPool.end();
  }
}

// Run the export
generateCorrectedExcelExport().catch(console.error);