#!/usr/bin/env node

/**
 * Enhanced Excel Chat Export with ZOHO ID and Employee Names
 * Reads from PostgreSQL (chat messages) and creates enhanced Excel report
 */

import pkg from 'pg';
const { Pool } = pkg;
import XLSX from 'xlsx';

// PostgreSQL connection using pg pool (environment variables already available in Replit)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Employee data mapping (simulated from the working application)
const employeeData = [
  { id: 1, zohoId: '10000011', name: 'M Abdullah Ansari', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 2, zohoId: '10000091', name: 'Kishor Kumar Sahu', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 3, zohoId: '10000211', name: 'Karthik  Kanaparthi', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 4, zohoId: '10000261', name: 'Kishore Babu Meduri', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 5, zohoId: '10000271', name: 'Kishore Chittabathina', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 7, zohoId: '10000301', name: 'Kishore  Sunkara', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 8, zohoId: '10000391', name: 'Prashanth Janardhanan', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 20, zohoId: '10002421', name: 'Anirudha Abhishek Gore', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 21, zohoId: '10002431', name: 'Ankit Kumar', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 28, zohoId: '10002811', name: 'Ashish Kumar Srivastava', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'Whilecap' },
  { id: 33, zohoId: '10003221', name: 'Bhavana  Duvvuru', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'Whilecap' },
  { id: 34, zohoId: '10003331', name: 'Bhavya Sri Madadi', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'Whilecap' },
  { id: 40, zohoId: '10003701', name: 'Buddhika Rangith Hettiarchchi', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 48, zohoId: '10004251', name: 'Dinesh Naidu Duppala', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'PlaceMaker' },
  { id: 49, zohoId: '10004311', name: 'Mohammad Bilal G', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 70, zohoId: '10006691', name: 'Khatiza Pathan', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'MENA Bev' },
  { id: 75, zohoId: '10007121', name: 'Laxman Reddy Seelam', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'Arcelik' },
  { id: 80, zohoId: '10008441', name: 'Praveen M G', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'Petbarn/Shopify' },
  { id: 94, zohoId: '10010191', name: 'Abdul Wahab', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'HD Supply' },
  { id: 98, zohoId: '10010411', name: 'Rukmani Devi Dutta', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'AI Training' },
  { id: 101, zohoId: '10010591', name: 'Sai Krishna Reddy', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'RAC ACIMA' },
  { id: 137, zohoId: '10013228', name: 'Laxmi Pavani', department: 'AI Innovation', businessUnit: 'Digital Commerce', client: 'Non-Billable' }
];

async function enhanceExcelWithEmployeeData() {
  try {
    console.log('🔄 Enhancing Excel chat export with ZOHO ID and Employee Names...');
    
    // Get chat messages from PostgreSQL
    console.log('📊 Fetching chat messages from PostgreSQL...');
    const result = await pool.query(`
      SELECT 
        id as chat_id,
        employee_id,
        sender as chat_entered_by,
        content as chat_content,
        timestamp as chat_entered_datetime
      FROM chat_messages 
      ORDER BY employee_id, timestamp
    `);
    const chatMessages = result.rows;
    
    console.log(`✅ Found ${chatMessages.length} chat messages`);
    
    // Create employee lookup map
    const employeeMap = new Map();
    employeeData.forEach(emp => {
      employeeMap.set(emp.id, {
        zohoId: emp.zohoId,
        fullName: emp.name,
        department: emp.department,
        businessUnit: emp.businessUnit,
        clientSecurity: emp.client
      });
    });
    
    // Combine chat messages with employee data for "All Chat Messages" tab
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
        'Content Length': String(chat.chat_content).length
      };
    });
    
    console.log('🔄 Creating Excel workbook...');
    
    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: All Chat Messages (with ZOHO ID and Employee Name)
    const allChatWorksheet = XLSX.utils.json_to_sheet(allChatMessagesData);
    const allChatColumnWidths = [
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, 
      { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 60 }, { wch: 20 }, { wch: 12 }
    ];
    allChatWorksheet['!cols'] = allChatColumnWidths;
    XLSX.utils.book_append_sheet(workbook, allChatWorksheet, 'All Chat Messages');
    
    // Sheet 2: Employee Analysis
    const employeeAnalysis = employeeData.map(emp => {
      const empChatMessages = chatMessages.filter(chat => chat.employee_id === emp.id);
      return {
        'Employee ID (Internal)': emp.id,
        'ZOHO ID': emp.zohoId,
        'Employee Name': emp.name,
        'Department': emp.department,
        'Business Unit': emp.businessUnit,
        'Client/Security': emp.client,
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
      { 'Metric': 'Total Employees in Database', 'Value': employeeData.length },
      { 'Metric': 'Employees with Chat Feedback', 'Value': new Set(chatMessages.map(m => m.employee_id)).size },
      { 'Metric': 'Coverage Percentage', 'Value': `${((new Set(chatMessages.map(m => m.employee_id)).size / employeeData.length) * 100).toFixed(1)}%` },
      { 'Metric': 'Unique Chat Contributors', 'Value': new Set(chatMessages.map(m => m.chat_entered_by)).size },
      { 'Metric': 'Average Messages per Employee', 'Value': (chatMessages.length / new Set(chatMessages.map(m => m.employee_id)).size).toFixed(1) },
      { 'Metric': 'Date Range', 'Value': 'June 2025 - July 2025' },
      { 'Metric': 'Analysis Generated', 'Value': new Date().toISOString().split('T')[0] }
    ];
    
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary Statistics');

    // Sheet 4: Missing Chat Data Analysis
    const employeesWithoutChat = employeeData.filter(emp => {
      return !chatMessages.some(chat => chat.employee_id === emp.id);
    }).map(emp => ({
      'Employee ID (Internal)': emp.id,
      'ZOHO ID': emp.zohoId,
      'Employee Name': emp.name,
      'Department': emp.department,
      'Business Unit': emp.businessUnit,
      'Client/Security': emp.client,
      'Status': 'Missing Chat Data'
    }));

    const missingDataWorksheet = XLSX.utils.json_to_sheet(employeesWithoutChat);
    missingDataWorksheet['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, 
      { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, missingDataWorksheet, 'Missing Chat Data');
    
    // Save Excel file
    const filename = 'Chat_Messages_Export_2025-07-06.xlsx';
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Enhanced Excel file created: ${filename}`);
    console.log(`📋 All Chat Messages tab now includes ZOHO ID and Employee Name columns`);
    console.log(`📊 Total: ${chatMessages.length} messages across ${new Set(chatMessages.map(m => m.employee_id)).size} employees`);
    
    // Show key mappings for verification
    console.log('\n🔍 Key Employee Chat Mappings:');
    const keyEmployees = [137, 49, 80, 94];
    keyEmployees.forEach(empId => {
      const emp = employeeMap.get(empId);
      const msgCount = chatMessages.filter(m => m.employee_id === empId).length;
      if (emp && msgCount > 0) {
        console.log(`  ✓ ${emp.fullName} (ZOHO: ${emp.zohoId}) - ${msgCount} messages`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error enhancing Excel file:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute the enhancement
enhanceExcelWithEmployeeData()
  .then(() => {
    console.log('🎉 Excel enhancement completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to enhance Excel file:', error);
    process.exit(1);
  });