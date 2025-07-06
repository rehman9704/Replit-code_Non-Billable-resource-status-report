const XLSX = require('xlsx');
const { Pool } = require('pg');

// Simple PostgreSQL-only export to identify chat mapping issues
const postgresConfig = {
  connectionString: process.env.DATABASE_URL
};

async function generateSimpleChatExport() {
  let postgresPool;
  
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    
    // Connect to PostgreSQL for chat messages
    postgresPool = new Pool(postgresConfig);
    
    console.log('✅ Connected to PostgreSQL successfully');
    
    // Get all chat messages with detailed analysis
    console.log('🔄 Fetching all chat messages...');
    const chatQuery = `
      SELECT 
        cm.id as chat_id,
        cm.employee_id,
        cm.sender as chat_entered_by,
        cm.content as chat_content,
        cm.timestamp as chat_entered_datetime,
        EXTRACT(DAY FROM cm.timestamp) as day,
        EXTRACT(MONTH FROM cm.timestamp) as month,
        EXTRACT(YEAR FROM cm.timestamp) as year
      FROM chat_messages cm
      ORDER BY cm.employee_id, cm.timestamp DESC
    `;
    
    const chatResult = await postgresPool.query(chatQuery);
    const chatMessages = chatResult.rows;
    
    console.log(`✅ Found ${chatMessages.length} chat messages`);
    
    // Create Excel data with analysis fields
    const excelData = chatMessages.map(chat => {
      return {
        'Chat ID': chat.chat_id,
        'Internal Employee ID': chat.employee_id,
        'Chat Entered By': chat.chat_entered_by,
        'Chat Content': chat.chat_content,
        'Chat Date/Time': new Date(chat.chat_entered_datetime).toLocaleString(),
        'Year': chat.year,
        'Month': chat.month,
        'Day': chat.day,
        'Content Length': chat.chat_content.length,
        'Sender Type': chat.chat_entered_by.includes('@') ? 'Email User' : 'System User',
        'Status': 'Active'
      };
    });
    
    // Create summary statistics
    const uniqueEmployees = new Set(chatMessages.map(c => c.employee_id));
    const uniqueSenders = new Set(chatMessages.map(c => c.chat_entered_by));
    const messagesByEmployee = {};
    
    chatMessages.forEach(chat => {
      if (!messagesByEmployee[chat.employee_id]) {
        messagesByEmployee[chat.employee_id] = 0;
      }
      messagesByEmployee[chat.employee_id]++;
    });
    
    // Employee message count analysis
    const employeeAnalysis = Array.from(uniqueEmployees).map(empId => {
      const empMessages = chatMessages.filter(c => c.employee_id === empId);
      const latestMessage = empMessages[0]; // Already sorted DESC
      const oldestMessage = empMessages[empMessages.length - 1];
      
      return {
        'Internal Employee ID': empId,
        'Total Messages': empMessages.length,
        'Latest Message Date': new Date(latestMessage.chat_entered_datetime).toLocaleString(),
        'Oldest Message Date': new Date(oldestMessage.chat_entered_datetime).toLocaleString(),
        'Unique Senders': new Set(empMessages.map(m => m.chat_entered_by)).size,
        'Average Message Length': Math.round(empMessages.reduce((sum, m) => sum + m.chat_content.length, 0) / empMessages.length),
        'Most Recent Content': latestMessage.chat_content.substring(0, 100) + (latestMessage.chat_content.length > 100 ? '...' : '')
      };
    });
    
    // Create workbook
    console.log('🔄 Creating Excel workbook...');
    const workbook = XLSX.utils.book_new();
    
    // Main chat data sheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Chat Messages');
    
    // Employee analysis sheet
    const employeeSheet = XLSX.utils.json_to_sheet(employeeAnalysis);
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employee Analysis');
    
    // Summary statistics
    const summaryData = [
      { Metric: 'Total Chat Messages', Value: chatMessages.length },
      { Metric: 'Unique Employees with Messages', Value: uniqueEmployees.size },
      { Metric: 'Unique Message Senders', Value: uniqueSenders.size },
      { Metric: 'Average Messages per Employee', Value: Math.round(chatMessages.length / uniqueEmployees.size) },
      { Metric: 'Earliest Message Date', Value: new Date(Math.min(...chatMessages.map(c => new Date(c.chat_entered_datetime)))).toLocaleString() },
      { Metric: 'Latest Message Date', Value: new Date(Math.max(...chatMessages.map(c => new Date(c.chat_entered_datetime)))).toLocaleString() },
      { Metric: 'Report Generated', Value: new Date().toLocaleString() },
      { Metric: 'Employee ID Range', Value: `${Math.min(...Array.from(uniqueEmployees))} - ${Math.max(...Array.from(uniqueEmployees))}` }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Sender analysis
    const senderAnalysis = Array.from(uniqueSenders).map(sender => {
      const senderMessages = chatMessages.filter(c => c.chat_entered_by === sender);
      return {
        'Sender': sender,
        'Total Messages': senderMessages.length,
        'Unique Employees': new Set(senderMessages.map(m => m.employee_id)).size,
        'Latest Activity': new Date(Math.max(...senderMessages.map(m => new Date(m.chat_entered_datetime)))).toLocaleString(),
        'Sender Type': sender.includes('@') ? 'Email User' : 'System User'
      };
    });
    
    const senderSheet = XLSX.utils.json_to_sheet(senderAnalysis);
    XLSX.utils.book_append_sheet(workbook, senderSheet, 'Sender Analysis');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Chat_Messages_Export_${timestamp}.xlsx`;
    
    // Write file
    XLSX.writeFile(workbook, filename);
    
    console.log('✅ Excel file generated successfully!');
    console.log(`📊 Report Summary:`);
    console.log(`   Total Messages: ${chatMessages.length}`);
    console.log(`   Employees with Messages: ${uniqueEmployees.size}`);
    console.log(`   Unique Senders: ${uniqueSenders.size}`);
    console.log(`   Employee ID Range: ${Math.min(...Array.from(uniqueEmployees))} - ${Math.max(...Array.from(uniqueEmployees))}`);
    console.log(`📁 File saved as: ${filename}`);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Error generating Excel file:', error);
    throw error;
  } finally {
    // Close connection
    if (postgresPool) {
      await postgresPool.end();
    }
  }
}

// Run the export
generateSimpleChatExport()
  .then(filename => {
    console.log(`🎉 Export completed successfully: ${filename}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to generate Excel file:', error);
    process.exit(1);
  });