#!/usr/bin/env node

/**
 * Fixed Excel Export Using Real Employee Data from Working System
 * Fetches actual employee data from the working application endpoints
 */

import pkg from 'pg';
const { Pool } = pkg;
import XLSX from 'xlsx';
import fetch from 'node-fetch';

// PostgreSQL connection for chat messages
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixExcelWithRealEmployeeData() {
  try {
    console.log('🔄 Fixing Excel export with real employee data from working system...');
    
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
    
    // Fetch all employees from the working API endpoint
    console.log('🔗 Fetching employee data from working API...');
    const response = await fetch('http://localhost:5000/api/employees?page=1&pageSize=1000');
    const employeeApiResponse = await response.json();
    const allEmployees = employeeApiResponse.data || [];
    
    console.log(`✅ Fetched ${allEmployees.length} employees from working API`);
    
    // Create employee lookup map indexed by internal ID (row number)
    const employeeMap = new Map();
    
    allEmployees.forEach((emp, index) => {
      const internalId = index + 1; // Row-based ID (1-based indexing)
      
      // Store by internal ID
      employeeMap.set(internalId, {
        zohoId: emp.zohoId || emp['Employee Number'] || 'N/A',
        fullName: emp.name || emp['Employee Name'] || 'Unknown',
        department: emp.department || emp['Department Name'] || 'N/A',
        businessUnit: emp.businessUnit || emp['Business Unit'] || 'N/A',
        clientSecurity: emp.client || emp['Client Name_Security'] || 'N/A'
      });
      
      // Log mapping for employees with chat messages
      if (employeeIdsWithChats.includes(internalId)) {
        console.log(`✓ Mapped Employee ID ${internalId}: ${emp.name || emp['Employee Name']} (ZOHO: ${emp.zohoId || emp['Employee Number']})`);
      }
    });
    
    console.log(`📈 Created mapping for ${employeeMap.size} employees`);
    
    // Combine chat messages with employee data for "All Chat Messages" tab
    const allChatMessagesData = chatMessages.map(chat => {
      const employee = employeeMap.get(chat.employee_id) || {
        zohoId: 'NOT_FOUND',
        fullName: 'Employee ID Not Found',
        department: 'NOT_FOUND',
        businessUnit: 'NOT_FOUND',
        clientSecurity: 'NOT_FOUND'
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
    const employeeAnalysis = employeeIdsWithChats.map(empId => {
      const empData = employeeMap.get(empId);
      const employeeMessages = chatMessages.filter(msg => msg.employee_id === empId);
      
      return {
        'Employee ID (Internal)': empId,
        'ZOHO ID': empData?.zohoId || 'NOT_FOUND',
        'Employee Name': empData?.fullName || 'NOT_FOUND',
        'Department': empData?.department || 'NOT_FOUND',
        'Business Unit': empData?.businessUnit || 'NOT_FOUND',
        'Client/Security': empData?.clientSecurity || 'NOT_FOUND',
        'Total Messages': employeeMessages.length,
        'First Message Date': employeeMessages.length > 0 ? new Date(Math.min(...employeeMessages.map(m => new Date(m.chat_entered_datetime)))).toLocaleDateString() : 'N/A',
        'Last Message Date': employeeMessages.length > 0 ? new Date(Math.max(...employeeMessages.map(m => new Date(m.chat_entered_datetime)))).toLocaleDateString() : 'N/A'
      };
    });
    
    const analysisSheet = XLSX.utils.json_to_sheet(employeeAnalysis);
    XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Employee Analysis');
    
    // Sheet 3: Summary Statistics
    const totalMessages = chatMessages.length;
    const totalEmployees = employeeIdsWithChats.length;
    const avgMessagesPerEmployee = totalEmployees > 0 ? (totalMessages / totalEmployees).toFixed(2) : '0';
    const messagesWithValidEmployees = allChatMessagesData.filter(msg => msg['ZOHO ID'] !== 'NOT_FOUND').length;
    const mappingSuccessRate = ((messagesWithValidEmployees / totalMessages) * 100).toFixed(1);
    
    const summaryData = [
      { Metric: 'Total Chat Messages', Value: totalMessages },
      { Metric: 'Total Employees with Messages', Value: totalEmployees },
      { Metric: 'Average Messages per Employee', Value: avgMessagesPerEmployee },
      { Metric: 'Messages with Valid Employee Mapping', Value: messagesWithValidEmployees },
      { Metric: 'Mapping Success Rate', Value: `${mappingSuccessRate}%` },
      { Metric: 'Total Employees in System', Value: allEmployees.length },
      { Metric: 'Export Generated', Value: new Date().toLocaleString() },
      { Metric: 'Data Source', Value: 'Real Working API + PostgreSQL Chat Messages' }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary Statistics');
    
    // Sheet 4: Mapping Details
    const mappingDetails = employeeIdsWithChats.map(empId => {
      const empData = employeeMap.get(empId);
      const messageCount = chatMessages.filter(msg => msg.employee_id === empId).length;
      
      return {
        'Employee ID (Internal)': empId,
        'ZOHO ID': empData?.zohoId || 'NOT_FOUND',
        'Employee Name': empData?.fullName || 'NOT_FOUND',
        'Mapping Status': empData ? 'SUCCESS' : 'FAILED',
        'Message Count': messageCount,
        'Notes': empData ? 'Mapped from working API' : 'Employee ID not found in system'
      };
    });
    
    const mappingSheet = XLSX.utils.json_to_sheet(mappingDetails);
    XLSX.utils.book_append_sheet(workbook, mappingSheet, 'Mapping Details');
    
    // Write Excel file
    const filename = 'Chat_Messages_Export_2025-07-06.xlsx';
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Fixed Excel file created: ${filename}`);
    console.log(`📋 All Chat Messages tab includes real ZOHO ID and Employee Name columns`);
    console.log(`📊 Total: ${totalMessages} messages across ${totalEmployees} employees`);
    console.log(`📈 Mapping Success Rate: ${mappingSuccessRate}%`);
    
    console.log('\\n🔍 Employee Chat Mappings Status:');
    employeeAnalysis.forEach(emp => {
      const status = emp['ZOHO ID'] === 'NOT_FOUND' ? '❌' : '✅';
      console.log(`  ${status} Employee ID ${emp['Employee ID (Internal)']}: ${emp['Employee Name']} (ZOHO: ${emp['ZOHO ID']}) - ${emp['Total Messages']} messages`);
    });
    
    console.log('🎉 Fixed Excel export completed successfully!');
    
  } catch (error) {
    console.error('❌ Error creating fixed Excel export:', error);
    throw error;
  } finally {
    await pgPool.end();
  }
}

// Run the export
fixExcelWithRealEmployeeData().catch(console.error);