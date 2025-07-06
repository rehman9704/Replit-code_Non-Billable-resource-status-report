/**
 * Find M Abdullah Ansari's Employee ID
 * Debug script to locate the correct employee mapping for M Abdullah Ansari
 */

const sql = require('mssql');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: false
  }
};

async function findAbdullahEmployeeId() {
  try {
    console.log('🔍 Connecting to Azure SQL Database...');
    const pool = await sql.connect(config);
    
    // Find M Abdullah Ansari in the database
    const abdullahQuery = `
      SELECT 
        ZohoID,
        [Employee Name],
        ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id,
        Department,
        [Business Unit],
        [Client/Security]
      FROM MergedEmployeeData 
      WHERE [Employee Name] LIKE '%Abdullah%Ansari%'
         OR [Employee Name] LIKE '%M Abdullah%'
         OR [Employee Name] LIKE '%Abdullah Ansari%'
      ORDER BY [Employee Name]
    `;
    
    console.log('🔍 Searching for M Abdullah Ansari...');
    const abdullahResult = await pool.request().query(abdullahQuery);
    
    if (abdullahResult.recordset.length === 0) {
      console.log('❌ M Abdullah Ansari not found in database');
      
      // Search for similar names
      console.log('🔍 Searching for similar names containing "Abdullah"...');
      const similarQuery = `
        SELECT TOP 10
          ZohoID,
          [Employee Name],
          ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id
        FROM MergedEmployeeData 
        WHERE [Employee Name] LIKE '%Abdullah%'
        ORDER BY [Employee Name]
      `;
      
      const similarResult = await pool.request().query(similarQuery);
      console.log('🔍 Found employees with "Abdullah" in name:');
      similarResult.recordset.forEach(emp => {
        console.log(`  - ${emp['Employee Name']} (ZOHO: ${emp.ZohoID}, Internal ID: ${emp.internal_id})`);
      });
    } else {
      console.log('✅ Found M Abdullah Ansari:');
      abdullahResult.recordset.forEach(emp => {
        console.log(`  - ${emp['Employee Name']} (ZOHO: ${emp.ZohoID}, Internal ID: ${emp.internal_id})`);
        console.log(`    Department: ${emp.Department}`);
        console.log(`    Business Unit: ${emp['Business Unit']}`);
        console.log(`    Client: ${emp['Client/Security']}`);
      });
    }
    
    // Also check which employee is currently at ID 30 (where the comment was saved)
    console.log('\n🔍 Checking who is employee ID 30 (where your comment was saved):');
    const id30Query = `
      SELECT TOP 1
        ZohoID,
        [Employee Name],
        ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id,
        Department
      FROM MergedEmployeeData 
      ORDER BY ZohoID
      OFFSET 29 ROWS
      FETCH NEXT 1 ROWS ONLY
    `;
    
    const id30Result = await pool.request().query(id30Query);
    if (id30Result.recordset.length > 0) {
      const emp = id30Result.recordset[0];
      console.log(`  Employee ID 30: ${emp['Employee Name']} (ZOHO: ${emp.ZohoID})`);
      console.log(`  Department: ${emp.Department}`);
    }
    
    await pool.close();
    
  } catch (error) {
    console.error('❌ Error finding Abdullah employee ID:', error);
  }
}

findAbdullahEmployeeId();