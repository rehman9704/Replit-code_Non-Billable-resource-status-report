/**
 * Debug Message to Employee Mapping
 * Investigates exact mapping between chat messages and employee names
 */

const sql = require('mssql');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.AZURE_SQL_USERNAME,
      password: process.env.AZURE_SQL_PASSWORD,
    },
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function debugMessageEmployeeMapping() {
  console.log('🔍 DEBUGGING MESSAGE TO EMPLOYEE MAPPING');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    await sql.connect(config);
    
    // 1. Get Employee ID 2 details from Azure SQL
    console.log('1️⃣ EMPLOYEE ID 2 IN AZURE SQL:');
    const employee2Query = `
      SELECT TOP 1 
        ROW_NUMBER() OVER (ORDER BY ZohoID) as id,
        ZohoID,
        FullName,
        Department,
        BusinessUnit,
        Client
      FROM Employees 
      WHERE ROW_NUMBER() OVER (ORDER BY ZohoID) = 2
    `;
    
    const employee2Result = await sql.query(employee2Query);
    if (employee2Result.recordset.length > 0) {
      const emp = employee2Result.recordset[0];
      console.log(`   ID: ${emp.id}`);
      console.log(`   ZohoID: ${emp.ZohoID}`);
      console.log(`   Name: ${emp.FullName}`);
      console.log(`   Department: ${emp.Department}`);
      console.log(`   Business Unit: ${emp.BusinessUnit}`);
      console.log(`   Client: ${emp.Client}`);
    }
    
    // 2. Check PostgreSQL chat messages for Employee ID 2
    console.log('\n2️⃣ CHAT MESSAGES FOR EMPLOYEE ID 2 IN POSTGRESQL:');
    const { Pool } = require('pg');
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const messagesResult = await pgPool.query(
      'SELECT id, sender, content, created_at FROM chat_messages WHERE employee_id = $1 ORDER BY created_at DESC',
      [2]
    );
    
    console.log(`   Found ${messagesResult.rows.length} messages for Employee ID 2`);
    
    if (messagesResult.rows.length > 0) {
      console.log('\n   📝 RECENT MESSAGES:');
      messagesResult.rows.slice(0, 5).forEach((msg, index) => {
        console.log(`   ${index + 1}. Sender: ${msg.sender}`);
        console.log(`      Content: ${msg.content.substring(0, 50)}...`);
        console.log(`      Date: ${msg.created_at}`);
      });
    }
    
    // 3. Check who actually entered comments for "Abdullah Wasi"
    console.log('\n3️⃣ SEARCHING FOR "ABDULLAH WASI" REFERENCES:');
    
    // Search in message content
    const abdullahContentSearch = await pgPool.query(
      `SELECT employee_id, sender, content, created_at 
       FROM chat_messages 
       WHERE LOWER(content) LIKE '%abdullah%' 
       OR LOWER(content) LIKE '%wasi%'
       ORDER BY created_at DESC`
    );
    
    console.log(`   Found ${abdullahContentSearch.rows.length} messages mentioning Abdullah/Wasi`);
    
    abdullahContentSearch.rows.forEach((msg, index) => {
      console.log(`   ${index + 1}. Employee ID: ${msg.employee_id}, Sender: ${msg.sender}`);
      console.log(`      Content: ${msg.content}`);
    });
    
    // 4. Search in sender names
    const abdullahSenderSearch = await pgPool.query(
      `SELECT employee_id, sender, content, created_at 
       FROM chat_messages 
       WHERE LOWER(sender) LIKE '%abdullah%' 
       OR LOWER(sender) LIKE '%wasi%'
       ORDER BY created_at DESC`
    );
    
    console.log(`\n   Found ${abdullahSenderSearch.rows.length} messages from Abdullah/Wasi as sender`);
    
    abdullahSenderSearch.rows.forEach((msg, index) => {
      console.log(`   ${index + 1}. Employee ID: ${msg.employee_id}, Sender: ${msg.sender}`);
      console.log(`      Content: ${msg.content.substring(0, 100)}`);
    });
    
    // 5. Check who the messages for Employee ID 2 should actually belong to
    console.log('\n4️⃣ CORRECT MAPPING VERIFICATION:');
    
    // Get the actual Employee ID 2 from Azure SQL with ROW_NUMBER
    const correctEmployeeQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ZohoID) as row_id,
        ZohoID,
        FullName,
        Department
      FROM Employees 
      WHERE ROW_NUMBER() OVER (ORDER BY ZohoID) = 2
    `;
    
    const correctResult = await sql.query(correctEmployeeQuery);
    if (correctResult.recordset.length > 0) {
      const correctEmp = correctResult.recordset[0];
      console.log(`   ✅ Employee ID 2 should be: ${correctEmp.FullName} (ZohoID: ${correctEmp.ZohoID})`);
      console.log(`   ✅ Department: ${correctEmp.Department}`);
      console.log(`   ✅ This employee should have the 15 messages`);
    }
    
    // 6. Find actual M Abdullah Ansari
    console.log('\n5️⃣ FINDING ACTUAL M ABDULLAH ANSARI:');
    const abdullahRealQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ZohoID) as row_id,
        ZohoID,
        FullName,
        Department
      FROM Employees 
      WHERE FullName LIKE '%Abdullah%'
    `;
    
    const abdullahRealResult = await sql.query(abdullahRealQuery);
    if (abdullahRealResult.recordset.length > 0) {
      abdullahRealResult.recordset.forEach(emp => {
        console.log(`   ✅ Found: ${emp.FullName} (ZohoID: ${emp.ZohoID}) - Should be Employee ID ${emp.row_id}`);
      });
    }
    
    await pgPool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎯 MAPPING DEBUG COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
}

debugMessageEmployeeMapping().catch(console.error);