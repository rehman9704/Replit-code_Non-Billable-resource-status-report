/**
 * Debug Employee Mapping
 * Shows the correct mapping between Employee IDs and Zoho IDs from Azure SQL Database
 */

const sql = require('mssql');

const azureConfig = {
  server: process.env.AZURE_SQL_SERVER || 'royalcyberdev.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'RoyalCyberDev',
  user: process.env.AZURE_SQL_USER || 'naseerkhan',
  password: process.env.AZURE_SQL_PASSWORD || 'royal@123',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 30000,
};

async function debugEmployeeMapping() {
  try {
    console.log('🔄 Connecting to Azure SQL Database...');
    const pool = await sql.connect(azureConfig);
    
    // Get employees that have chat messages
    const chatEmployees = [1, 2, 4, 10, 14, 16, 17, 18, 20, 21, 22, 25, 27, 28, 31, 33, 34, 36, 39, 40, 41, 42, 44, 46, 47, 48, 49, 52, 53, 55, 57, 58, 60, 61, 63, 68, 70, 71, 73, 74, 75, 76, 80, 84, 94, 97, 98, 101, 105, 106, 108, 119, 137];
    
    const result = await pool.request().query(`
      SELECT ID, ZohoID, FullName 
      FROM TimesheetBillability 
      WHERE ID IN (${chatEmployees.join(',')})
      ORDER BY ID
    `);
    
    console.log('\\n📋 CURRENT MAPPING - Employee ID to Zoho ID:');
    console.log('=============================================');
    result.recordset.forEach(emp => {
      console.log(`ID: ${emp.ID.toString().padStart(3)} | Zoho: ${emp.ZohoID.toString().padStart(8)} | Name: ${emp.FullName}`);
    });
    
    // Now get some chat message examples
    console.log('\\n\\n💬 SAMPLE CHAT MESSAGES:');
    console.log('========================');
    const { Pool } = require('pg');
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const chatResult = await pgPool.query(`
      SELECT id, employee_id, sender, content, timestamp
      FROM chat_messages 
      WHERE employee_id IN (${chatEmployees.slice(0,10).join(',')})
      ORDER BY employee_id, id
      LIMIT 20
    `);
    
    chatResult.rows.forEach(msg => {
      console.log(`Employee ID: ${msg.employee_id} | Sender: ${msg.sender} | Content: ${msg.content.substring(0, 60)}...`);
    });
    
    await pool.close();
    await pgPool.end();
    
    console.log('\\n\\n🎯 ISSUE IDENTIFIED:');
    console.log('====================');
    console.log('Chat messages are stored with Employee IDs, but we need to map them to correct Zoho IDs');
    console.log('This explains why comments appear under wrong employees in the Excel report.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugEmployeeMapping();