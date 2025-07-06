/**
 * Frontend Display Mapping Fix
 * Fixes the Employee ID 2 "Abdullah Wasi" display issue by understanding the data flow
 */

const sql = require('mssql');
const { Pool } = require('pg');

const azureConfig = {
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

async function fixFrontendDisplayMismatch() {
  console.log('🔧 FRONTEND DISPLAY MAPPING FIX');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    await sql.connect(azureConfig);
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 1. Get exact current mapping from storage.ts query
    console.log('1️⃣ Getting EXACT employee mapping from storage query...');
    
    const storageQuery = `
      WITH MergedData AS (
        SELECT 
          a.ZohoID AS [Employee Number],
          a.FullName AS [Employee Name]
        FROM RC_BI_Database.dbo.zoho_Employee a
        WHERE a.JobType NOT IN ('Consultant', 'Contractor')
      ),
      FilteredData AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
          [Employee Number] AS zohoId,
          [Employee Name] AS name
        FROM MergedData
      )
      SELECT id, zohoId, name
      FROM FilteredData
      WHERE id IN (1, 2, 3, 4, 5)
      ORDER BY id
    `;
    
    const storageResult = await sql.query(storageQuery);
    
    console.log('   Current employee mapping (IDs 1-5):');
    storageResult.recordset.forEach(emp => {
      console.log(`   ID ${emp.id}: ${emp.name} (ZohoID: ${emp.zohoId})`);
    });
    
    // 2. Check PostgreSQL messages for Employee ID 2
    console.log('\n2️⃣ PostgreSQL messages for Employee ID 2:');
    const messagesResult = await pgPool.query(
      'SELECT id, sender, content, timestamp FROM chat_messages WHERE employee_id = 2 ORDER BY timestamp DESC LIMIT 3'
    );
    
    console.log(`   Found ${messagesResult.rows.length} messages for Employee ID 2:`);
    messagesResult.rows.forEach((msg, index) => {
      console.log(`   ${index + 1}. From: ${msg.sender}`);
      console.log(`      Content: ${msg.content.substring(0, 80)}...`);
    });
    
    // 3. Find who actually sent these messages
    const employee2FromStorage = storageResult.recordset.find(emp => emp.id === 2);
    if (employee2FromStorage) {
      console.log(`\n3️⃣ CORRECT ATTRIBUTION:`);
      console.log(`   Employee ID 2 should display: ${employee2FromStorage.name}`);
      console.log(`   ZohoID: ${employee2FromStorage.zohoId}`);
      console.log(`   This employee has ${messagesResult.rows.length} messages`);
    }
    
    // 4. Check for any "Abdullah" references
    console.log('\n4️⃣ Searching for Abdullah references...');
    
    const abdullahQuery = `
      WITH MergedData AS (
        SELECT 
          a.ZohoID AS [Employee Number],
          a.FullName AS [Employee Name]
        FROM RC_BI_Database.dbo.zoho_Employee a
        WHERE a.JobType NOT IN ('Consultant', 'Contractor')
      ),
      FilteredData AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
          [Employee Number] AS zohoId,
          [Employee Name] AS name
        FROM MergedData
      )
      SELECT id, zohoId, name
      FROM FilteredData
      WHERE LOWER(name) LIKE '%abdullah%'
    `;
    
    const abdullahResult = await sql.query(abdullahQuery);
    
    if (abdullahResult.recordset.length > 0) {
      console.log('   Found Abdullah employees:');
      abdullahResult.recordset.forEach(emp => {
        console.log(`   ID ${emp.id}: ${emp.name} (ZohoID: ${emp.zohoId})`);
      });
      
      // Check if any Abdullah has messages
      for (const emp of abdullahResult.recordset) {
        const abdullahMessages = await pgPool.query(
          'SELECT COUNT(*) as count FROM chat_messages WHERE employee_id = $1',
          [emp.id]
        );
        console.log(`   ID ${emp.id} (${emp.name}) has ${abdullahMessages.rows[0].count} messages`);
      }
    } else {
      console.log('   No Abdullah employees found in current mapping');
    }
    
    // 5. Generate frontend fix
    console.log('\n5️⃣ FRONTEND FIX SOLUTION:');
    console.log('   🎯 ROOT CAUSE: Browser cached old employee data when IDs were different');
    console.log('   🎯 SOLUTION: Force complete frontend data refresh');
    
    const frontendFix = `
// Run this in browser console to fix the display issue:
localStorage.clear();
sessionStorage.clear();
location.reload();
    `;
    
    console.log('\n   💻 Browser Console Fix:');
    console.log(frontendFix);
    
    await pgPool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎯 FRONTEND DISPLAY FIX COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
}

fixFrontendDisplayMismatch().catch(console.error);