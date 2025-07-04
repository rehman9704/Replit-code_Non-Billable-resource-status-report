/**
 * Generate Excel Export: Employee Chat Messages
 * Combines Azure SQL Database employee data with PostgreSQL chat messages
 * Exports: Zoho ID, Employee Name, Chat Messages by all users
 */

const { Pool } = require('pg');
const sql = require('mssql');
const XLSX = require('xlsx');
const fs = require('fs');

// PostgreSQL connection (chat messages)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Azure SQL Database connection (employee data)
const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function generateExcelExport() {
  try {
    console.log('🔄 Starting Excel export generation...');
    
    // Get all chat messages from PostgreSQL
    console.log('📋 Fetching chat messages from PostgreSQL...');
    const chatResult = await pgPool.query(`
      SELECT 
        employee_id,
        sender,
        content,
        timestamp,
        id as message_id
      FROM chat_messages 
      ORDER BY employee_id, timestamp ASC
    `);
    
    console.log(`✅ Retrieved ${chatResult.rows.length} chat messages`);
    
    // Get employee data from Azure SQL Database
    console.log('👥 Fetching employee data from Azure SQL Database...');
    const azurePool = await sql.connect(azureConfig);
    const employeeResult = await azurePool.request().query(`
      SELECT 
        ZohoID,
        FullName,
        ROW_NUMBER() OVER (ORDER BY ZohoID) as employee_id
      FROM MergedData 
      ORDER BY ZohoID
    `);
    
    console.log(`✅ Retrieved ${employeeResult.recordset.length} employees`);
    
    // Create employee lookup map
    const employeeMap = {};
    employeeResult.recordset.forEach(emp => {
      employeeMap[emp.employee_id] = {
        zohoId: emp.ZohoID,
        name: emp.FullName
      };
    });
    
    // Combine data for Excel export
    const exportData = [];
    
    chatResult.rows.forEach(message => {
      const employee = employeeMap[message.employee_id];
      
      if (employee) {
        exportData.push({
          'Zoho ID': employee.zohoId,
          'Employee Name': employee.name,
          'Message Sender': message.sender,
          'Chat Message': message.content,
          'Timestamp': new Date(message.timestamp).toLocaleString(),
          'Employee ID (Internal)': message.employee_id,
          'Message ID': message.message_id
        });
      } else {
        // Include messages even if employee not found
        exportData.push({
          'Zoho ID': 'N/A',
          'Employee Name': 'N/A',
          'Message Sender': message.sender,
          'Chat Message': message.content,
          'Timestamp': new Date(message.timestamp).toLocaleString(),
          'Employee ID (Internal)': message.employee_id,
          'Message ID': message.message_id
        });
      }
    });
    
    // Sort by Zoho ID and timestamp
    exportData.sort((a, b) => {
      if (a['Zoho ID'] !== b['Zoho ID']) {
        return a['Zoho ID'].localeCompare(b['Zoho ID']);
      }
      return new Date(a.Timestamp) - new Date(b.Timestamp);
    });
    
    console.log(`📊 Prepared ${exportData.length} records for export`);
    
    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-size columns
    const cols = [
      { wch: 12 }, // Zoho ID
      { wch: 25 }, // Employee Name
      { wch: 25 }, // Message Sender
      { wch: 60 }, // Chat Message
      { wch: 20 }, // Timestamp
      { wch: 15 }, // Employee ID (Internal)
      { wch: 12 }  // Message ID
    ];
    ws['!cols'] = cols;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Chat Messages');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Employee_Chat_Messages_${timestamp}.xlsx`;
    
    // Write Excel file
    XLSX.writeFile(wb, filename);
    
    console.log(`✅ Excel export completed: ${filename}`);
    console.log(`📈 Total records exported: ${exportData.length}`);
    
    // Show summary by unique employees
    const uniqueEmployees = new Set(exportData.map(row => row['Zoho ID']));
    console.log(`👥 Unique employees with messages: ${uniqueEmployees.size}`);
    
    // Show summary by message senders
    const uniqueSenders = new Set(exportData.map(row => row['Message Sender']));
    console.log(`📝 Unique message senders: ${uniqueSenders.size}`);
    console.log(`📝 Message senders: ${Array.from(uniqueSenders).join(', ')}`);
    
    await azurePool.close();
    await pgPool.end();
    
    return {
      filename,
      totalRecords: exportData.length,
      uniqueEmployees: uniqueEmployees.size,
      uniqueSenders: uniqueSenders.size
    };
    
  } catch (error) {
    console.error('❌ Error generating Excel export:', error);
    throw error;
  }
}

// Run the export
generateExcelExport()
  .then(result => {
    console.log('\n🎉 Excel export completed successfully!');
    console.log(`📂 File: ${result.filename}`);
    console.log(`📊 Total records: ${result.totalRecords}`);
    console.log(`👥 Unique employees: ${result.uniqueEmployees}`);
    console.log(`📝 Unique senders: ${result.uniqueSenders}`);
  })
  .catch(error => {
    console.error('💥 Export failed:', error);
    process.exit(1);
  });