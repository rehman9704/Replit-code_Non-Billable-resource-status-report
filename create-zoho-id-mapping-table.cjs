/**
 * ZOHO ID MAPPING TABLE CREATION
 * 
 * Creates a proper mapping between PostgreSQL employee_id and Azure SQL ZohoID
 * Ensures chat messages are correctly attributed using actual Zoho IDs
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

async function createZohoIdMappingTable() {
  let azureConnection;
  
  try {
    console.log('🔄 CREATING ZOHO ID MAPPING TABLE - CEO PRIORITY');
    console.log('='.repeat(80));
    
    // Step 1: Connect to Azure SQL and get all employees with Zoho IDs
    console.log('\n🔗 Connecting to Azure SQL Database...');
    azureConnection = await sql.connect(azureConfig);
    
    const azureEmployeesResult = await azureConnection.request().query(`
      SELECT ID, ZohoID, FullName
      FROM RC_BI_Database.dbo.zoho_Employee 
      WHERE ZohoID IS NOT NULL AND ZohoID != ''
      ORDER BY ID
    `);
    
    console.log(`📊 Found ${azureEmployeesResult.recordset.length} employees in Azure SQL`);
    
    // Step 2: Create mapping table in PostgreSQL
    console.log('\n🔧 Creating employee_zoho_mapping table in PostgreSQL...');
    
    await pgPool.query(`
      DROP TABLE IF EXISTS employee_zoho_mapping CASCADE;
    `);
    
    await pgPool.query(`
      CREATE TABLE employee_zoho_mapping (
        internal_id SERIAL PRIMARY KEY,
        zoho_id VARCHAR(50) UNIQUE NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        azure_sql_id BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Step 3: Insert all Azure SQL employees into mapping table
    console.log('\n📥 Inserting employee mapping data...');
    
    let insertedCount = 0;
    for (const emp of azureEmployeesResult.recordset) {
      await pgPool.query(`
        INSERT INTO employee_zoho_mapping (zoho_id, employee_name, azure_sql_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (zoho_id) DO UPDATE SET
          employee_name = EXCLUDED.employee_name,
          azure_sql_id = EXCLUDED.azure_sql_id
      `, [emp.ZohoID, emp.FullName, emp.ID]);
      insertedCount++;
    }
    
    console.log(`✅ Inserted ${insertedCount} employee mappings`);
    
    // Step 4: Verify key employees exist in mapping
    console.log('\n🔍 Verifying key employees in mapping table...');
    
    const keyZohoIds = ['10012260', '10012267', '10114331', '10013228'];
    for (const zohoId of keyZohoIds) {
      const result = await pgPool.query(`
        SELECT internal_id, zoho_id, employee_name, azure_sql_id
        FROM employee_zoho_mapping 
        WHERE zoho_id = $1
      `, [zohoId]);
      
      if (result.rows.length > 0) {
        const emp = result.rows[0];
        console.log(`   ✅ ${emp.employee_name} (Zoho: ${emp.zoho_id}) → Internal ID: ${emp.internal_id}`);
      } else {
        console.log(`   ❌ Zoho ID ${zohoId} NOT FOUND in mapping table`);
      }
    }
    
    // Step 5: Create indexes for performance
    console.log('\n🚀 Creating indexes for performance...');
    
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_zoho_mapping_zoho_id 
      ON employee_zoho_mapping(zoho_id);
    `);
    
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_zoho_mapping_internal_id 
      ON employee_zoho_mapping(internal_id);
    `);
    
    console.log('✅ Indexes created successfully');
    
    // Step 6: Show mapping table statistics
    const statsResult = await pgPool.query(`
      SELECT COUNT(*) as total_mappings,
             COUNT(DISTINCT zoho_id) as unique_zoho_ids,
             MIN(internal_id) as min_internal_id,
             MAX(internal_id) as max_internal_id
      FROM employee_zoho_mapping
    `);
    
    const stats = statsResult.rows[0];
    console.log('\n📊 MAPPING TABLE STATISTICS:');
    console.log(`   Total mappings: ${stats.total_mappings}`);
    console.log(`   Unique Zoho IDs: ${stats.unique_zoho_ids}`);
    console.log(`   Internal ID range: ${stats.min_internal_id} - ${stats.max_internal_id}`);
    
    console.log('\n✅ ZOHO ID MAPPING TABLE CREATED SUCCESSFULLY');
    console.log('='.repeat(80));
    
    return {
      success: true,
      totalMappings: stats.total_mappings,
      uniqueZohoIds: stats.unique_zoho_ids
    };
    
  } catch (error) {
    console.error('❌ MAPPING TABLE CREATION ERROR:', error);
    throw error;
  } finally {
    if (azureConnection) {
      await azureConnection.close();
    }
    await pgPool.end();
  }
}

// Execute the mapping table creation
createZohoIdMappingTable()
  .then(result => {
    console.log('\n🎉 ZOHO ID MAPPING TABLE READY!');
    console.log(`📊 ${result.totalMappings} employee mappings created`);
    console.log('\n🚀 NEXT: Run chat message re-attribution using proper Zoho IDs');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 MAPPING TABLE CREATION FAILED:', error);
    process.exit(1);
  });