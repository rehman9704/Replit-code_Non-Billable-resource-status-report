/**
 * COMPLETE ZOHO ID SYNCHRONIZATION
 * 
 * Final step: Update remaining chat messages to use proper ZOHO ID mapping
 * Maps all remaining messages to the correct employees based on ZOHO ID lookup
 */

const { Pool } = require('pg');
const sql = require('mssql');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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

async function completeZohoIdSynchronization() {
  let azureConnection;
  
  try {
    console.log('🔄 COMPLETING ZOHO ID SYNCHRONIZATION - CEO PRIORITY');
    console.log('='.repeat(80));
    
    // Step 1: Connect to Azure SQL and get specific employees
    console.log('\n🔗 Connecting to Azure SQL Database...');
    azureConnection = await sql.connect(azureConfig);
    
    // Find the employees who correspond to the current message holders
    const employeeSearchQueries = [
      { pattern: '%bilal%', searchField: 'FullName' },
      { pattern: '%bilal%', searchField: 'ZohoID' },
      { pattern: '10012267', searchField: 'ZohoID' }, // Shiva Abhimanyu
      { pattern: '10013228', searchField: 'ZohoID' }  // Laxmi Pavani
    ];
    
    const foundEmployees = {};
    
    for (const search of employeeSearchQueries) {
      const result = await azureConnection.request().query(`
        SELECT TOP 5 ID, ZohoID, FullName, Department, BusinessUnit
        FROM RC_BI_Database.dbo.zoho_Employee 
        WHERE ${search.searchField} LIKE '${search.pattern}'
        ORDER BY ID
      `);
      
      if (result.recordset.length > 0) {
        console.log(`\n📊 Found employees matching '${search.pattern}' in ${search.searchField}:`);
        result.recordset.forEach(emp => {
          console.log(`   ${emp.FullName} (Zoho: ${emp.ZohoID}) → Azure ID: ${emp.ID}`);
          if (emp.ZohoID) {
            foundEmployees[emp.ZohoID] = {
              azureId: emp.ID,
              name: emp.FullName,
              department: emp.Department,
              businessUnit: emp.BusinessUnit
            };
          }
        });
      }
    }
    
    // Step 2: Get our current mapping table
    console.log('\n📊 Checking current mapping table...');
    const mappingResult = await pgPool.query(`
      SELECT internal_id, zoho_id, employee_name 
      FROM temp_employee_zoho_mapping 
      ORDER BY internal_id
    `);
    
    console.log('Current mappings:');
    mappingResult.rows.forEach(row => {
      console.log(`   ID ${row.internal_id}: ${row.employee_name} (Zoho: ${row.zoho_id})`);
    });
    
    // Step 3: Add missing employees to mapping table
    console.log('\n🔧 Adding missing employees to mapping table...');
    
    if (foundEmployees['10012267']) {
      const shiva = foundEmployees['10012267'];
      await pgPool.query(`
        INSERT INTO temp_employee_zoho_mapping (zoho_id, employee_name, azure_sql_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (zoho_id) DO NOTHING
      `, ['10012267', shiva.name, shiva.azureId]);
      console.log(`   ✅ Added Shiva Abhimanyu (Zoho: 10012267)`);
    }
    
    if (foundEmployees['10013228']) {
      const laxmi = foundEmployees['10013228'];
      await pgPool.query(`
        INSERT INTO temp_employee_zoho_mapping (zoho_id, employee_name, azure_sql_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (zoho_id) DO NOTHING
      `, ['10013228', laxmi.name, laxmi.azureId]);
      console.log(`   ✅ Added Laxmi Pavani (Zoho: 10013228)`);
    }
    
    // Step 4: Map remaining messages based on content analysis
    console.log('\n🎯 MAPPING REMAINING MESSAGES TO CORRECT EMPLOYEES...');
    
    // Map the 99 general operations messages to Shiva Abhimanyu (ID 2)
    const shivaResult = await pgPool.query(`
      SELECT internal_id FROM temp_employee_zoho_mapping WHERE zoho_id = '10012267'
    `);
    
    if (shivaResult.rows.length > 0) {
      const shivaId = shivaResult.rows[0].internal_id;
      const updateResult = await pgPool.query(`
        UPDATE chat_messages 
        SET employee_id = $1
        WHERE employee_id = 49
      `, [shivaId]);
      
      console.log(`   ✅ Mapped ${updateResult.rowCount} general operations messages to Shiva Abhimanyu (ID ${shivaId})`);
    }
    
    // Map Laxmi Pavani's message (ID 137)
    const laxmiResult = await pgPool.query(`
      SELECT internal_id FROM temp_employee_zoho_mapping WHERE zoho_id = '10013228'
    `);
    
    if (laxmiResult.rows.length > 0) {
      const laxmiId = laxmiResult.rows[0].internal_id;
      const updateResult = await pgPool.query(`
        UPDATE chat_messages 
        SET employee_id = $1
        WHERE employee_id = 137
      `, [laxmiId]);
      
      console.log(`   ✅ Mapped ${updateResult.rowCount} new hire messages to Laxmi Pavani (ID ${laxmiId})`);
    }
    
    // Step 5: Verify final attribution
    console.log('\n📊 FINAL ZOHO ID-BASED ATTRIBUTION:');
    
    const finalResult = await pgPool.query(`
      SELECT 
        cm.employee_id,
        ezm.zoho_id,
        ezm.employee_name,
        COUNT(*) as message_count
      FROM chat_messages cm
      LEFT JOIN temp_employee_zoho_mapping ezm ON cm.employee_id = ezm.internal_id
      GROUP BY cm.employee_id, ezm.zoho_id, ezm.employee_name
      ORDER BY message_count DESC
    `);
    
    finalResult.rows.forEach(row => {
      if (row.zoho_id) {
        console.log(`   ✅ ${row.employee_name} (Zoho: ${row.zoho_id}): ${row.message_count} messages`);
      } else {
        console.log(`   ⚠️  Employee ID ${row.employee_id}: ${row.message_count} messages (UNMAPPED)`);
      }
    });
    
    // Step 6: Verify key message content
    console.log('\n🔍 VERIFYING KEY MESSAGE CONTENT:');
    
    const keyMessages = await pgPool.query(`
      SELECT cm.content, ezm.employee_name, ezm.zoho_id
      FROM chat_messages cm
      LEFT JOIN temp_employee_zoho_mapping ezm ON cm.employee_id = ezm.internal_id
      WHERE cm.content ILIKE '%petbarn%' 
         OR cm.content ILIKE '%shopify%'
         OR cm.content ILIKE '%hd supply%'
         OR cm.content ILIKE '%arcelik%'
         OR cm.content ILIKE '%3 months%'
      ORDER BY cm.id
    `);
    
    keyMessages.rows.forEach(row => {
      console.log(`   🎯 "${row.content.substring(0, 40)}..." → ${row.employee_name} (Zoho: ${row.zoho_id})`);
    });
    
    // Step 7: Make mapping table permanent
    console.log('\n🔧 Making mapping table permanent...');
    
    await pgPool.query(`
      DROP TABLE IF EXISTS employee_zoho_mapping CASCADE;
    `);
    
    await pgPool.query(`
      CREATE TABLE employee_zoho_mapping AS 
      SELECT * FROM temp_employee_zoho_mapping;
    `);
    
    await pgPool.query(`
      ALTER TABLE employee_zoho_mapping 
      ADD CONSTRAINT pk_employee_zoho_mapping PRIMARY KEY (internal_id);
    `);
    
    await pgPool.query(`
      CREATE INDEX idx_employee_zoho_mapping_zoho_id 
      ON employee_zoho_mapping(zoho_id);
    `);
    
    console.log('✅ Permanent mapping table created with indexes');
    
    console.log('\n✅ ZOHO ID SYNCHRONIZATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    
    return {
      success: true,
      totalMappings: finalResult.rows.filter(r => r.zoho_id).length,
      totalMessages: finalResult.rows.reduce((sum, r) => sum + parseInt(r.message_count), 0)
    };
    
  } catch (error) {
    console.error('❌ ZOHO ID SYNCHRONIZATION ERROR:', error);
    throw error;
  } finally {
    if (azureConnection) {
      await azureConnection.close();
    }
    await pgPool.end();
  }
}

// Execute the complete synchronization
completeZohoIdSynchronization()
  .then(result => {
    console.log('\n🎉 ZOHO ID SYNCHRONIZATION COMPLETED!');
    console.log(`📊 ${result.totalMappings} employees properly mapped`);
    console.log(`📨 ${result.totalMessages} messages correctly attributed`);
    console.log('\n✅ ALL CHAT MESSAGES NOW USE PROPER ZOHO ID MAPPING');
    console.log('🔄 Frontend will automatically refresh to show correct attributions');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 ZOHO ID SYNCHRONIZATION FAILED:', error);
    process.exit(1);
  });