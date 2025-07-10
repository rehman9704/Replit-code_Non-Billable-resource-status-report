/**
 * Complete Chat Export - All Comments Including Historical Data
 * Exports both current intended comments and historical chat messages
 */

const { neon } = require('@neondatabase/serverless');
const XLSX = require('xlsx');

const postgresClient = neon(process.env.DATABASE_URL);

async function completeExport() {
  console.log('📊 Creating complete chat export with all historical data...');
  
  try {
    // Get current intended comments
    const currentComments = await postgresClient(`
      SELECT 
        'Current System' as source,
        cci.intended_employee_name as employee_name,
        cci.intended_zoho_id as zoho_id, 
        cci.sender as entered_by,
        cci.content as comment_text,
        cci.created_at as date_entered,
        cci.is_visible as is_visible
      FROM chat_comments_intended cci
      ORDER BY cci.created_at DESC
    `);

    // Get historical backup messages with correct column names
    const historicalMessages = await postgresClient(`
      SELECT 
        'Historical Backup' as source,
        CASE 
          WHEN cmb.employee_id IS NOT NULL THEN 
            (SELECT e.name FROM employees e WHERE e.id = cmb.employee_id LIMIT 1)
          ELSE 'Unknown Employee'
        END as employee_name,
        CASE 
          WHEN cmb.employee_id IS NOT NULL THEN 
            (SELECT e.zoho_id FROM employees e WHERE e.id = cmb.employee_id LIMIT 1)
          ELSE 'N/A'
        END as zoho_id,
        cmb.sender as entered_by,
        cmb.content as comment_text,
        cmb.timestamp as date_entered,
        true as is_visible
      FROM chat_messages_backup cmb
      ORDER BY cmb.timestamp DESC
    `);

    console.log(`📋 Current comments: ${currentComments.length}`);
    console.log(`📋 Historical messages: ${historicalMessages.length}`);

    // Combine all data
    const allComments = [...currentComments, ...historicalMessages];
    
    console.log(`📊 Total comments to export: ${allComments.length}`);

    if (allComments.length === 0) {
      console.log('⚠️ No comments found to export');
      return;
    }

    // Format for Excel with proper headers
    const excelData = allComments.map((comment, index) => ({
      "Row Number": index + 1,
      "Data Source": comment.source,
      "Employee Name": comment.employee_name || 'Not Specified',
      "Zoho ID": comment.zoho_id || 'Not Available',
      "Comment Text": comment.comment_text || '',
      "Comment Entered By": comment.entered_by || 'Unknown',
      "Date Time Entered": comment.date_entered ? 
        new Date(comment.date_entered).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) : 'No Date',
      "Is Visible": comment.is_visible ? 'Yes' : 'No'
    }));

    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new();

    // Sheet 1: All Comments
    const allSheet = XLSX.utils.json_to_sheet(excelData);
    allSheet['!cols'] = [
      { wch: 8 },  // Row Number
      { wch: 18 }, // Data Source
      { wch: 25 }, // Employee Name
      { wch: 12 }, // Zoho ID
      { wch: 60 }, // Comment Text
      { wch: 25 }, // Comment Entered By
      { wch: 20 }, // Date Time Entered
      { wch: 10 }  // Is Visible
    ];
    XLSX.utils.book_append_sheet(workbook, allSheet, 'All Comments');

    // Sheet 2: Current System Only
    const currentOnly = excelData.filter(item => item["Data Source"] === "Current System");
    if (currentOnly.length > 0) {
      const currentSheet = XLSX.utils.json_to_sheet(currentOnly);
      currentSheet['!cols'] = allSheet['!cols'];
      XLSX.utils.book_append_sheet(workbook, currentSheet, 'Current Comments');
    }

    // Sheet 3: Historical Only
    const historicalOnly = excelData.filter(item => item["Data Source"] === "Historical Backup");
    if (historicalOnly.length > 0) {
      const historicalSheet = XLSX.utils.json_to_sheet(historicalOnly);
      historicalSheet['!cols'] = allSheet['!cols'];
      XLSX.utils.book_append_sheet(workbook, historicalSheet, 'Historical Comments');
    }

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `Complete_Chat_Export_${timestamp}.xlsx`;

    // Write Excel file
    XLSX.writeFile(workbook, filename);

    console.log(`✅ Complete chat export created: ${filename}`);
    console.log(`📊 Total records exported: ${allComments.length}`);
    
    // Summary statistics
    const currentCount = currentComments.length;
    const historicalCount = historicalMessages.length;
    
    console.log('\n📈 Export Summary:');
    console.log(`  Current System Comments: ${currentCount}`);
    console.log(`  Historical Backup Messages: ${historicalCount}`);
    console.log(`  Total Combined: ${allComments.length}`);
    
    // Comments by sender summary
    const commentsBySender = {};
    allComments.forEach(comment => {
      const sender = comment.entered_by || 'Unknown';
      commentsBySender[sender] = (commentsBySender[sender] || 0) + 1;
    });

    console.log('\n📊 Comments by sender:');
    Object.entries(commentsBySender)
      .sort(([,a], [,b]) => b - a)
      .forEach(([sender, count]) => {
        console.log(`  ${sender}: ${count} comments`);
      });

    return filename;

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

completeExport();