const XLSX = require('xlsx');

async function readOriginalExcel() {
  try {
    console.log('🔄 Reading original Excel file...');
    
    // Read the Excel file
    const workbook = XLSX.readFile('attached_assets/Employee Comments _ Availabel in Database_5th July 2025_1751777397087.xlsx');
    
    console.log('📋 Available worksheets:', workbook.SheetNames);
    
    // Read all worksheets
    workbook.SheetNames.forEach(sheetName => {
      console.log(`\n📊 Sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`   Rows: ${data.length}`);
      if (data.length > 0) {
        console.log('   Columns:', Object.keys(data[0]).join(', '));
        
        // Show first 5 rows as sample
        console.log('\n   Sample data:');
        data.slice(0, 5).forEach((row, index) => {
          console.log(`   Row ${index + 1}:`, JSON.stringify(row, null, 2));
        });
      }
    });
    
    // Extract the main data (assuming first sheet has the employee comments)
    const mainSheet = workbook.Sheets[workbook.SheetNames[0]];
    const employeeData = XLSX.utils.sheet_to_json(mainSheet);
    
    console.log(`\n✅ Found ${employeeData.length} employee records in original file`);
    
    // Find records with comments/feedback
    const recordsWithComments = employeeData.filter(row => {
      // Look for any field that might contain comments
      return Object.values(row).some(value => {
        if (typeof value === 'string' && value.length > 20) {
          return value.includes('billable') || value.includes('project') || 
                 value.includes('client') || value.includes('training') ||
                 value.includes('opportunity') || value.includes('support');
        }
        return false;
      });
    });
    
    console.log(`\n📝 Found ${recordsWithComments.length} records with comments:`);
    
    recordsWithComments.forEach((record, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      Object.entries(record).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 20) {
          console.log(`${key}: ${value}`);
        } else if (key.toLowerCase().includes('zoho') || key.toLowerCase().includes('id') || 
                   key.toLowerCase().includes('name')) {
          console.log(`${key}: ${value}`);
        }
      });
    });
    
    return {
      totalRecords: employeeData.length,
      recordsWithComments: recordsWithComments,
      allData: employeeData
    };
    
  } catch (error) {
    console.error('❌ Error reading Excel file:', error);
    throw error;
  }
}

// Run the script
readOriginalExcel()
  .then(result => {
    console.log(`\n🎉 Successfully analyzed original Excel file`);
    console.log(`   Total records: ${result.totalRecords}`);
    console.log(`   Records with comments: ${result.recordsWithComments.length}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Failed to read Excel file:', error);
    process.exit(1);
  });