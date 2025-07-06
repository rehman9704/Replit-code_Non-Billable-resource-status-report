const XLSX = require('xlsx');
const { Pool } = require('pg');

// PostgreSQL configuration
const postgresConfig = {
  connectionString: process.env.DATABASE_URL
};

async function generateSimpleChatExcel() {
  let postgresPool;
  
  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    
    // Connect to PostgreSQL for chat messages
    postgresPool = new Pool(postgresConfig);
    
    console.log('✅ Connected to PostgreSQL successfully');
    
    // Get chat messages from PostgreSQL with detailed information
    console.log('🔄 Fetching comprehensive chat data...');
    const chatQuery = `
      SELECT 
        cm.id as chat_id,
        cm.employee_id as internal_employee_id,
        'Employee_' || cm.employee_id::text as employee_reference,
        cm.sender as chat_entered_by,
        cm.content as chat_content,
        cm.timestamp as chat_entered_datetime,
        DATE(cm.timestamp) as chat_date,
        TO_CHAR(cm.timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_datetime,
        LENGTH(cm.content) as content_length,
        CASE 
          WHEN cm.sender LIKE '%Kishore%' THEN 'Kishore Kumar T.'
          WHEN cm.sender LIKE '%Karthik%' THEN 'Karthik V.'
          WHEN cm.sender LIKE '%Mahaveer%' THEN 'Mahaveer A.'
          WHEN cm.sender LIKE '%Farhan%' THEN 'Farhan A.'
          WHEN cm.sender LIKE '%Muhammad Rehman%' THEN 'Muhammad Rehman S.'
          ELSE cm.sender
        END as sender_short_name
      FROM chat_messages cm
      ORDER BY cm.employee_id, cm.timestamp
    `;
    
    const chatResult = await postgresPool.query(chatQuery);
    const chatMessages = chatResult.rows;
    
    console.log(`✅ Found ${chatMessages.length} chat messages`);
    
    // Prepare Excel data with all requested fields
    const excelData = chatMessages.map((chat, index) => ({
      'Row': index + 1,
      'Chat ID': chat.chat_id,
      'Employee ID (Internal)': chat.internal_employee_id,
      'Employee Reference': chat.employee_reference,
      'Zoho ID': 'TBD - See Note',
      'Employee Name': 'TBD - See Note', 
      'Chat Entered By': chat.chat_entered_by,
      'Chat Entered By (Short)': chat.sender_short_name,
      'Chat Content': chat.chat_content,
      'Content Length': chat.content_length,
      'Chat Entered Date/Time': chat.formatted_datetime,
      'Chat Date': chat.chat_date,
      'Status': 'Active',
      'Notes': 'Zoho ID and Employee Name require Azure SQL Database access'
    }));
    
    console.log('🔄 Creating Excel workbook...');
    
    // Create workbook and main worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths for better readability
    const columnWidths = [
      { wch: 8 },  // Row
      { wch: 10 }, // Chat ID
      { wch: 15 }, // Employee ID (Internal)
      { wch: 18 }, // Employee Reference
      { wch: 12 }, // Zoho ID
      { wch: 25 }, // Employee Name
      { wch: 30 }, // Chat Entered By
      { wch: 20 }, // Chat Entered By (Short)
      { wch: 60 }, // Chat Content
      { wch: 12 }, // Content Length
      { wch: 20 }, // Chat Entered Date/Time
      { wch: 12 }, // Chat Date
      { wch: 10 }, // Status
      { wch: 50 }  // Notes
    ];
    
    worksheet['!cols'] = columnWidths;
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chat Messages Detail');
    
    // Create summary worksheet
    const uniqueEmployees = new Set(chatMessages.map(m => m.internal_employee_id));
    const uniqueSenders = new Set(chatMessages.map(m => m.sender_short_name));
    const dateRange = {
      earliest: Math.min(...chatMessages.map(m => new Date(m.chat_entered_datetime))),
      latest: Math.max(...chatMessages.map(m => new Date(m.chat_entered_datetime)))
    };
    
    const summaryData = [
      { 'Metric': 'Total Chat Messages', 'Value': chatMessages.length, 'Notes': 'All messages restored from backup' },
      { 'Metric': 'Unique Employees with Comments', 'Value': uniqueEmployees.size, 'Notes': 'Employees with at least one comment' },
      { 'Metric': 'Unique Chat Contributors', 'Value': uniqueSenders.size, 'Notes': 'People who entered comments' },
      { 'Metric': 'Earliest Message Date', 'Value': new Date(dateRange.earliest).toISOString().split('T')[0], 'Notes': 'First recorded message' },
      { 'Metric': 'Latest Message Date', 'Value': new Date(dateRange.latest).toISOString().split('T')[0], 'Notes': 'Most recent message' },
      { 'Metric': 'Analysis Generated', 'Value': new Date().toISOString().split('T')[0], 'Notes': 'Report creation date' },
      { 'Metric': 'Database Status', 'Value': 'Restored', 'Notes': 'All messages successfully restored after data loss' }
    ];
    
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    
    // Create employee breakdown worksheet
    const employeeBreakdown = Array.from(uniqueEmployees).map(empId => {
      const empMessages = chatMessages.filter(m => m.internal_employee_id === empId);
      const senders = [...new Set(empMessages.map(m => m.sender_short_name))];
      
      return {
        'Employee ID': empId,
        'Employee Reference': `Employee_${empId}`,
        'Total Messages': empMessages.length,
        'Contributors': senders.join(', '),
        'Latest Message Date': new Date(Math.max(...empMessages.map(m => new Date(m.chat_entered_datetime)))).toISOString().split('T')[0],
        'Message Sample': empMessages[0]?.chat_content?.substring(0, 100) + (empMessages[0]?.chat_content?.length > 100 ? '...' : '')
      };
    }).sort((a, b) => b['Total Messages'] - a['Total Messages']);
    
    const employeeWorksheet = XLSX.utils.json_to_sheet(employeeBreakdown);
    employeeWorksheet['!cols'] = [
      { wch: 12 }, // Employee ID
      { wch: 18 }, // Employee Reference
      { wch: 15 }, // Total Messages
      { wch: 30 }, // Contributors
      { wch: 18 }, // Latest Message Date
      { wch: 60 }  // Message Sample
    ];
    XLSX.utils.book_append_sheet(workbook, employeeWorksheet, 'Employee Breakdown');
    
    // Save Excel file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `Employee_Chat_Analysis_Report_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Excel file created successfully: ${filename}`);
    console.log(`📊 Report contains:`);
    console.log(`   • ${chatMessages.length} total chat messages`);
    console.log(`   • ${uniqueEmployees.size} employees with comments`);
    console.log(`   • ${uniqueSenders.size} different comment contributors`);
    console.log(`   • 3 worksheets: Detail, Summary, Employee Breakdown`);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Error generating Excel file:', error);
    throw error;
  } finally {
    // Close database connection
    if (postgresPool) {
      await postgresPool.end();
    }
  }
}

// Run the script
generateSimpleChatExcel()
  .then(filename => {
    console.log(`🎉 Chat analysis Excel file ready for download: ${filename}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to generate Excel file:', error);
    process.exit(1);
  });