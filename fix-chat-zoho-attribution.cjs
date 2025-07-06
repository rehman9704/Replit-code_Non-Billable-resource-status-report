/**
 * Fix Chat Attribution to Match Correct ZOHO IDs
 * Reassign chat messages to the correct employees based on Azure SQL Database ZOHO ID mapping
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

async function fixChatZohoAttribution() {
  console.log('🔧 FIXING CHAT ATTRIBUTION TO MATCH CORRECT ZOHO IDs');
  
  try {
    // Connect to Azure SQL
    const azurePool = await sql.connect(azureConfig);
    
    // Get the correct ZOHO ID mapping for employees with chat messages
    const currentChatEmployees = await pgPool.query(`
      SELECT DISTINCT employee_id, COUNT(*) as message_count
      FROM chat_messages 
      GROUP BY employee_id
      ORDER BY employee_id
    `);
    
    console.log('\n=== EMPLOYEES WITH CHAT MESSAGES ===');
    currentChatEmployees.rows.forEach(row => {
      console.log(`Internal ID ${row.employee_id}: ${row.message_count} messages`);
    });
    
    // Get the mapping for specific employees that need ZOHO ID correction
    const employeeMapping = {
      // Current wrong mappings need to be fixed:
      11: { shouldBeZoho: 10000202, shouldBeName: 'Talal Ul Haq', currentlyZoho: 10000010, currentlyName: 'Aashir Ahmed' },
      80: { shouldBeZoho: 10008441, shouldBeName: 'Praveen M G', currentlyZoho: 10000079, currentlyName: 'Faiyaz Ahmed' },
      137: { shouldBeZoho: 10013228, shouldBeName: 'Laxmi Pavani', currentlyZoho: 10000137, currentlyName: 'Lokesh Paluri' }
    };
    
    console.log('\n=== REQUIRED MAPPING CORRECTIONS ===');
    Object.keys(employeeMapping).forEach(internalId => {
      const mapping = employeeMapping[internalId];
      console.log(`Internal ID ${internalId}:`);
      console.log(`  Currently maps to: ZOHO ${mapping.currentlyZoho} (${mapping.currentlyName})`);
      console.log(`  Should map to: ZOHO ${mapping.shouldBeZoho} (${mapping.shouldBeName})`);
    });
    
    // Find the correct internal IDs for the target ZOHO IDs
    const targetZohoIds = [10000202, 10008441, 10013228]; // Talal, Praveen, Laxmi
    
    const correctMappingResult = await azurePool.request().query(`
      WITH RankedEmployees AS (
        SELECT 
          ZohoID,
          FullName,
          ROW_NUMBER() OVER (ORDER BY ZohoID) as internal_id
        FROM RC_BI_Database.dbo.zoho_Employee
        WHERE ZohoID IS NOT NULL
          AND ISNUMERIC(ZohoID) = 1
          AND LEN(ZohoID) <= 10
      )
      SELECT internal_id, ZohoID, FullName
      FROM RankedEmployees 
      WHERE ZohoID IN ('${targetZohoIds.join("', '")}')
      ORDER BY ZohoID
    `);
    
    console.log('\n=== CORRECT INTERNAL IDs FOR TARGET EMPLOYEES ===');
    correctMappingResult.recordset.forEach(emp => {
      console.log(`ZOHO ${emp.ZohoID} (${emp.FullName}) → Internal ID ${emp.internal_id}`);
    });
    
    // Create mapping from old internal ID to new internal ID
    const idMappingCorrections = {
      11: correctMappingResult.recordset.find(emp => emp.ZohoID === 10000202)?.internal_id || 11, // Talal
      80: correctMappingResult.recordset.find(emp => emp.ZohoID === 10008441)?.internal_id || 80, // Praveen
      137: correctMappingResult.recordset.find(emp => emp.ZohoID === 10013228)?.internal_id || 137  // Laxmi
    };
    
    console.log('\n=== INTERNAL ID CORRECTIONS ===');
    Object.keys(idMappingCorrections).forEach(oldId => {
      const newId = idMappingCorrections[oldId];
      if (newId !== parseInt(oldId)) {
        console.log(`🔄 Internal ID ${oldId} → Internal ID ${newId}`);
      } else {
        console.log(`✅ Internal ID ${oldId} already correct`);
      }
    });
    
    // Update chat messages to use correct internal IDs
    let updatedCount = 0;
    for (const [oldId, newId] of Object.entries(idMappingCorrections)) {
      if (newId !== parseInt(oldId)) {
        const updateResult = await pgPool.query(`
          UPDATE chat_messages 
          SET employee_id = $1
          WHERE employee_id = $2
        `, [newId, parseInt(oldId)]);
        
        console.log(`✅ Updated ${updateResult.rowCount} messages from ID ${oldId} → ID ${newId}`);
        updatedCount += updateResult.rowCount;
      }
    }
    
    console.log(`\n🎉 TOTAL MESSAGES UPDATED: ${updatedCount}`);
    
    // Verify the final mapping
    const finalVerification = await pgPool.query(`
      SELECT DISTINCT employee_id, COUNT(*) as message_count
      FROM chat_messages 
      GROUP BY employee_id
      ORDER BY employee_id
    `);
    
    console.log('\n=== FINAL CHAT MESSAGE DISTRIBUTION ===');
    finalVerification.rows.forEach(row => {
      const targetEmployee = correctMappingResult.recordset.find(emp => emp.internal_id === row.employee_id);
      if (targetEmployee) {
        console.log(`Internal ID ${row.employee_id}: ${row.message_count} messages → ZOHO ${targetEmployee.ZohoID} (${targetEmployee.FullName})`);
      } else {
        console.log(`Internal ID ${row.employee_id}: ${row.message_count} messages → Unknown employee`);
      }
    });
    
    await azurePool.close();
    await pgPool.end();
    
    console.log('\n✅ CHAT ATTRIBUTION CORRECTION COMPLETE');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixChatZohoAttribution();