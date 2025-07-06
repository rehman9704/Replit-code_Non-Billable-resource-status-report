/**
 * Fix ZOHO ID mapping between PostgreSQL and Azure SQL Database
 * This script identifies the correct ZOHO IDs for employees with chat messages
 */
const sql = require('mssql');
const { Pool } = require('pg');

// Azure SQL Database configuration
const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// PostgreSQL configuration
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixZohoIdMapping() {
  console.log('🔍 ANALYZING ZOHO ID MAPPING DISCREPANCIES');
  
  try {
    // Connect to Azure SQL
    const azurePool = await sql.connect(azureConfig);
    
    // Get Azure SQL employees with ROW_NUMBER ordering (how internal IDs are assigned)
    const azureResult = await azurePool.request().query(`
      WITH RankedEmployees AS (
        SELECT 
          ZohoID,
          FullName,
          ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id
        FROM RC_BI_Database.dbo.zoho_Employee
        WHERE ZohoID IS NOT NULL
      )
      SELECT internal_id, ZohoID, FullName
      FROM RankedEmployees 
      WHERE internal_id IN (11, 80, 137)
      ORDER BY internal_id
    `);
    
    console.log('\n=== AZURE SQL DATABASE MAPPING ===');
    azureResult.recordset.forEach(emp => {
      console.log(`Internal ID ${emp.internal_id}: ZOHO ${emp.ZohoID} - ${emp.FullName}`);
    });
    
    // Get PostgreSQL chat messages for these internal IDs
    const pgResult = await pgPool.query(`
      SELECT DISTINCT employee_id, sender, COUNT(*) as message_count
      FROM chat_messages 
      WHERE employee_id IN (11, 80, 137)
      GROUP BY employee_id, sender
      ORDER BY employee_id, message_count DESC
    `);
    
    console.log('\n=== POSTGRESQL CHAT MESSAGES ===');
    pgResult.rows.forEach(row => {
      console.log(`Internal ID ${row.employee_id}: ${row.message_count} messages from ${row.sender}`);
    });
    
    // Create the correct mapping
    console.log('\n=== MAPPING ANALYSIS ===');
    const azureMapping = {};
    azureResult.recordset.forEach(emp => {
      azureMapping[emp.internal_id] = {
        zohoId: emp.ZohoID,
        name: emp.FullName
      };
    });
    
    pgResult.rows.forEach(row => {
      const azureEmp = azureMapping[row.employee_id];
      if (azureEmp) {
        console.log(`✅ Internal ID ${row.employee_id}: Chat messages (${row.message_count}) → ZOHO ${azureEmp.zohoId} (${azureEmp.name})`);
      } else {
        console.log(`❌ Internal ID ${row.employee_id}: Chat messages found but no Azure employee mapping`);
      }
    });
    
    // Get all chat messages with their correct ZOHO mappings
    const allChatMessages = await pgPool.query(`
      SELECT id, employee_id, sender, content, timestamp
      FROM chat_messages 
      WHERE employee_id IN (11, 80, 137)
      ORDER BY employee_id, timestamp DESC
    `);
    
    console.log('\n=== COMPLETE CHAT MESSAGE MAPPING ===');
    allChatMessages.rows.forEach(msg => {
      const azureEmp = azureMapping[msg.employee_id];
      if (azureEmp) {
        console.log(`Chat ID ${msg.id}: Employee ${msg.employee_id} (ZOHO ${azureEmp.zohoId} - ${azureEmp.name})`);
        console.log(`  Content: "${msg.content.substring(0, 80)}..."`);
        console.log(`  Sender: ${msg.sender}`);
        console.log(`  Date: ${msg.timestamp}`);
        console.log('');
      }
    });
    
    await azurePool.close();
    await pgPool.end();
    
    console.log('✅ ZOHO ID mapping analysis complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixZohoIdMapping();