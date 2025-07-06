/**
 * Critical Debug: Muhammad Bilal G Chat Mapping Issue
 * User reported that chat for Muhammad Bilal G (ZOHO: 10012233) is missing
 * This script identifies the correct internal ID and fixes the mapping
 */

const { Pool } = require('pg');
const sql = require('mssql');

async function debugMuhammadBilalMapping() {
  console.log('🔍 DEBUGGING MUHAMMAD BILAL G CHAT MAPPING ISSUE');
  console.log('================================================');
  
  // Connect to PostgreSQL (chat messages)
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Connect to Azure SQL (employee data)
  const azureConfig = {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  };

  try {
    console.log('📊 STEP 1: Finding Muhammad Bilal G in Azure SQL Database');
    await sql.connect(azureConfig);
    
    // Find Muhammad Bilal G using various name patterns
    const employeeQuery = `
      SELECT ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id, 
             ZohoID, FullName, Department, BusinessUnit, ClientSecurity
      FROM MergedEmployeeData 
      WHERE FullName LIKE '%Muhammad%Bilal%' 
         OR FullName LIKE '%Bilal%G%'
         OR ZohoID = '10012233'
      ORDER BY ZohoID
    `;
    
    const employeeResult = await sql.query(employeeQuery);
    console.log('\n📋 FOUND MUHAMMAD BILAL G:');
    console.table(employeeResult.recordset);
    
    if (employeeResult.recordset.length === 0) {
      console.log('❌ Muhammad Bilal G not found in Azure SQL Database!');
      
      // Search for similar names
      const similarQuery = `
        SELECT ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id, 
               ZohoID, FullName
        FROM MergedEmployeeData 
        WHERE FullName LIKE '%Bilal%' OR FullName LIKE '%Muhammad%'
        ORDER BY FullName
      `;
      
      const similarResult = await sql.query(similarQuery);
      console.log('\n🔍 SIMILAR NAMES FOUND:');
      console.table(similarResult.recordset);
    }
    
    console.log('\n📊 STEP 2: Finding Optimizely Chat Messages in PostgreSQL');
    
    // Find the specific chat message about Optimizely
    const chatQuery = `
      SELECT id, employee_id, sender, content, timestamp 
      FROM chat_messages 
      WHERE content ILIKE '%optimizely%'
      ORDER BY timestamp DESC
    `;
    
    const chatResult = await pgPool.query(chatQuery);
    console.log('\n💬 OPTIMIZELY CHAT MESSAGES:');
    console.table(chatResult.rows);
    
    console.log('\n📊 STEP 3: Cross-referencing Current Mapping');
    
    // For each chat message, find what employee it's currently mapped to
    for (const chat of chatResult.rows) {
      const mappedEmployeeQuery = `
        SELECT TOP 1 ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id, 
               ZohoID, FullName
        FROM MergedEmployeeData 
        ORDER BY ZohoID
        OFFSET ${chat.employee_id - 1} ROWS
        FETCH NEXT 1 ROWS ONLY
      `;
      
      const mappedResult = await sql.query(mappedEmployeeQuery);
      
      console.log(`\n🔗 Chat ID ${chat.id} (Employee ID ${chat.employee_id}):`);
      console.log(`   Content: "${chat.content.substring(0, 60)}..."`);
      console.log(`   Currently mapped to: ${mappedResult.recordset[0]?.FullName} (ZOHO: ${mappedResult.recordset[0]?.ZohoID})`);
      console.log(`   ❌ SHOULD BE mapped to: Muhammad Bilal G (ZOHO: 10012233)`);
    }
    
    console.log('\n📊 STEP 4: Identifying the Correct Internal ID for Muhammad Bilal G');
    
    // Find the correct internal ID for Muhammad Bilal G
    const correctIDQuery = `
      SELECT ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id, 
             ZohoID, FullName
      FROM MergedEmployeeData 
      WHERE ZohoID = '10012233'
    `;
    
    const correctIDResult = await sql.query(correctIDQuery);
    
    if (correctIDResult.recordset.length > 0) {
      const correctEmployee = correctIDResult.recordset[0];
      console.log(`\n✅ CORRECT MAPPING FOUND:`);
      console.log(`   Muhammad Bilal G should have Internal ID: ${correctEmployee.internal_id}`);
      console.log(`   ZOHO ID: ${correctEmployee.ZohoID}`);
      console.log(`   Full Name: ${correctEmployee.FullName}`);
      
      return {
        correctInternalId: correctEmployee.internal_id,
        zohoId: correctEmployee.ZohoID,
        fullName: correctEmployee.FullName,
        wronglyMappedChats: chatResult.rows
      };
    } else {
      console.log('❌ Could not find Muhammad Bilal G with ZOHO ID 10012233 in database');
      return null;
    }
    
  } catch (error) {
    console.error('💥 Error in debugging:', error);
  } finally {
    await pgPool.end();
    await sql.close();
  }
}

// Run the debug
debugMuhammadBilalMapping().then(result => {
  if (result) {
    console.log('\n🎯 SUMMARY:');
    console.log(`✅ Muhammad Bilal G correct Internal ID: ${result.correctInternalId}`);
    console.log(`❌ ${result.wronglyMappedChats.length} chat messages need to be remapped`);
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Update chat messages to use correct employee_id');
    console.log('2. Verify frontend displays correct employee name');
    console.log('3. Re-generate Excel export with correct mapping');
  } else {
    console.log('\n❌ Failed to identify correct mapping - manual intervention required');
  }
}).catch(console.error);