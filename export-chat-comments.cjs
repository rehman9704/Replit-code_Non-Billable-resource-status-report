/**
 * Export Chat Comments to Excel
 * Exports all chat comments with employee details, timestamps, and sender information
 */

const { neon } = require('@neondatabase/serverless');
const XLSX = require('xlsx');

const postgresClient = neon(process.env.DATABASE_URL);

async function exportChatComments() {
  console.log('📊 Exporting all chat comments to Excel...');
  
  try {
    // Get all comments from chat_comments_intended table
    const comments = await postgresClient(`
      SELECT 
        cci.id,
        cci.intended_employee_name as "Employee Name",
        cci.intended_zoho_id as "Zoho ID", 
        cci.sender as "Comment Entered By",
        cci.content as "Comment Text",
        cci.created_at as "Date Time Entered",
        cci.is_visible as "Is Visible",
        cci.actual_employee_id as "Employee ID in Database"
      FROM chat_comments_intended cci
      ORDER BY cci.created_at DESC
    `);

    console.log(`📋 Found ${comments.length} comments to export`);

    if (comments.length === 0) {
      console.log('⚠️ No comments found to export');
      return;
    }

    // Format the data for Excel
    const excelData = comments.map(comment => ({
      "Employee Name": comment["Employee Name"],
      "Zoho ID": comment["Zoho ID"],
      "Comment Text": comment["Comment Text"],
      "Comment Entered By": comment["Comment Entered By"],
      "Date Time Entered": new Date(comment["Date Time Entered"]).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      "Is Visible": comment["Is Visible"] ? 'Yes' : 'No',
      "Employee ID in Database": comment["Employee ID in Database"]
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-adjust column widths
    const columnWidths = [
      { wch: 25 }, // Employee Name
      { wch: 12 }, // Zoho ID
      { wch: 50 }, // Comment Text
      { wch: 20 }, // Comment Entered By
      { wch: 20 }, // Date Time Entered
      { wch: 10 }, // Is Visible
      { wch: 15 }  // Employee ID in Database
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chat Comments');

    // Generate filename with current timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `Chat_Comments_Export_${timestamp}.xlsx`;

    // Write Excel file
    XLSX.writeFile(workbook, filename);

    console.log(`✅ Chat comments exported successfully to: ${filename}`);
    console.log(`📊 Total comments exported: ${comments.length}`);
    
    // Show summary of comments by sender
    const commentsBySender = {};
    comments.forEach(comment => {
      const sender = comment["Comment Entered By"];
      commentsBySender[sender] = (commentsBySender[sender] || 0) + 1;
    });

    console.log('\n📈 Comments by sender:');
    Object.entries(commentsBySender).forEach(([sender, count]) => {
      console.log(`  ${sender}: ${count} comments`);
    });

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportChatComments();