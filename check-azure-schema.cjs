const sql = require('mssql');

// Azure SQL Server configuration
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

async function checkAzureSchema() {
  try {
    console.log('🔄 Connecting to Azure SQL Server...');
    const pool = await sql.connect(azureConfig);
    console.log('✅ Connected successfully');
    
    // Get table schema information
    console.log('🔍 Checking zoho_Employee table schema...');
    const schemaQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'zoho_Employee' 
        AND TABLE_SCHEMA = 'dbo'
      ORDER BY ORDINAL_POSITION
    `;
    
    const schemaResult = await pool.request().query(schemaQuery);
    console.log('\n📋 Available columns in zoho_Employee table:');
    schemaResult.recordset.forEach((col, index) => {
      console.log(`${index + 1}. ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''}) - ${col.IS_NULLABLE === 'YES' ? 'Nullable' : 'Not Null'}`);
    });
    
    // Sample some data to see actual values
    console.log('\n🔍 Sample data from zoho_Employee table:');
    const sampleQuery = `
      SELECT TOP 5 *
      FROM RC_BI_Database.dbo.zoho_Employee 
      WHERE ZohoID IS NOT NULL 
      ORDER BY ZohoID
    `;
    
    const sampleResult = await pool.request().query(sampleQuery);
    console.log('\n📊 Sample records:');
    sampleResult.recordset.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      Object.keys(record).forEach(key => {
        console.log(`  ${key}: ${record[key]}`);
      });
      console.log('---');
    });
    
    await pool.close();
    console.log('🔌 Connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAzureSchema();