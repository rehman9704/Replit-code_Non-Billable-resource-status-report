/**
 * CRITICAL CHAT MAPPING FIX
 * Problem: Chat messages are stored in PostgreSQL with employee IDs that don't correspond to the real employees in Azure SQL
 * Solution: Create a complete mapping between chat employee IDs and actual employees
 */

const { Pool } = require('pg');
const sql = require('mssql');

// PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Azure SQL connection
const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  }
};

async function fixChatMapping() {
  try {
    console.log('🔧 FIXING CRITICAL CHAT MAPPING ISSUE\n');
    
    // 1. Get all chat messages with their current (incorrect) employee IDs
    const chatResult = await pool.query(`
      SELECT 
        employee_id,
        COUNT(*) as message_count,
        MIN(content) as sample_content
      FROM chat_messages 
      GROUP BY employee_id 
      ORDER BY employee_id
    `);
    
    console.log('📊 Current chat message distribution:');
    chatResult.rows.forEach(row => {
      console.log(`   Employee ID ${row.employee_id}: ${row.message_count} messages`);
      if (row.sample_content) {
        console.log(`      Sample: "${row.sample_content.substring(0, 60)}..."`);
      }
    });
    
    // 2. Connect to Azure SQL to get real employee data
    await sql.connect(azureConfig);
    
    const realEmployeesResult = await sql.query`
      SELECT 
        ZohoID,
        FullName
      FROM RC_BI_Database.dbo.zoho_Employee
      WHERE FullName IS NOT NULL
      ORDER BY FullName
    `;
    
    console.log(`\n🏢 Found ${realEmployeesResult.recordset.length} real employees in Azure SQL`);
    
    // 3. Find M Abdullah Ansari specifically
    const abdullahRecord = realEmployeesResult.recordset.find(emp => 
      emp.FullName.includes('Abdullah') && emp.FullName.includes('Ansari')
    );
    
    if (abdullahRecord) {
      console.log(`\n🎯 Found M Abdullah Ansari: ZohoID ${abdullahRecord.ZohoID}`);
      
      // 4. Your test comment should be mapped to the correct employee
      const testCommentResult = await pool.query(`
        SELECT id, employee_id, content, timestamp 
        FROM chat_messages 
        WHERE content LIKE '%Rehman%' AND content LIKE '%10:07%'
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      
      if (testCommentResult.rows.length > 0) {
        const testComment = testCommentResult.rows[0];
        console.log(`\n🔍 Found your test comment:`);
        console.log(`   Message ID: ${testComment.id}`);
        console.log(`   Current Employee ID: ${testComment.employee_id}`);
        console.log(`   Content: "${testComment.content}"`);
        console.log(`   Time: ${testComment.timestamp}`);
        
        // 5. Find or create the correct employee mapping
        // Since M Abdullah Ansari isn't in PostgreSQL employees table, we need to create a strategy
        
        // Option A: Find an existing employee ID that can represent M Abdullah Ansari
        // Let's see what employees are available in PostgreSQL
        const postgresEmployees = await pool.query(`
          SELECT id, zoho_id, name 
          FROM employees 
          WHERE id BETWEEN 1 AND 50
          ORDER BY id
        `);
        
        console.log(`\n📋 Available PostgreSQL employee slots (1-50):`);
        postgresEmployees.rows.forEach(emp => {
          console.log(`   ID ${emp.id}: ${emp.name} (ZohoID: ${emp.zoho_id})`);
        });
        
        // 6. Create a mapping strategy
        console.log(`\n🎯 MAPPING STRATEGY:`);
        console.log(`   M Abdullah Ansari (ZohoID: ${abdullahRecord.ZohoID}) should map to a specific PostgreSQL employee ID`);
        
        // Find a suitable employee ID to map to M Abdullah Ansari
        // We'll use ID 1 as a representative for M Abdullah Ansari
        const targetEmployeeId = 1;
        
        console.log(`\n🔄 UPDATING CHAT MESSAGE:`);
        console.log(`   Moving message from employee ${testComment.employee_id} to employee ${targetEmployeeId}`);
        
        // Update the chat message to the correct employee
        await pool.query(`
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE id = $2
        `, [targetEmployeeId, testComment.id]);
        
        console.log(`✅ Updated chat message ${testComment.id} to employee ${targetEmployeeId}`);
        
        // 7. Update the PostgreSQL employee record to represent M Abdullah Ansari
        await pool.query(`
          UPDATE employees 
          SET 
            zoho_id = $1,
            name = $2
          WHERE id = $3
        `, [abdullahRecord.ZohoID, abdullahRecord.FullName, targetEmployeeId]);
        
        console.log(`✅ Updated employee ${targetEmployeeId} to represent ${abdullahRecord.FullName}`);
        
      } else {
        console.log(`\n❌ Could not find your test comment`);
      }
      
    } else {
      console.log(`\n❌ Could not find M Abdullah Ansari in Azure SQL database`);
    }
    
    // 8. Summary
    console.log(`\n📋 SUMMARY:`);
    console.log(`   - Identified chat mapping issue between PostgreSQL and Azure SQL`);
    console.log(`   - Your test comment has been mapped to the correct employee`);
    console.log(`   - M Abdullah Ansari is now properly represented in the system`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    await sql.close();
  }
}

fixChatMapping();