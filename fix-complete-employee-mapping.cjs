/**
 * CRITICAL FIX: Complete Employee Mapping Synchronization
 * Creates comprehensive ZOHO ID mapping for ALL employees to fix frontend display issues
 * 
 * ISSUE: Abdullah Wasi incorrectly showing 92 messages that belong to Shiva Abhimanyu
 * CAUSE: Incomplete employee_zoho_mapping table with only 4 employees instead of 190+
 */

const { Pool } = require('@neondatabase/serverless');
const sql = require('mssql');

async function fixCompleteEmployeeMapping() {
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔄 CREATING COMPLETE EMPLOYEE MAPPING - FIXING FRONTEND DISPLAY ISSUES');
    
    // Connect to Azure SQL Database
    const azurePool = new sql.ConnectionPool({
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    });
    
    await azurePool.connect();
    console.log('✅ Connected to Azure SQL Database');
    
    // Get ALL employees with their correct frontend ordering
    const allEmployees = await azurePool.request().query(`
      SELECT 
        row_number() OVER (ORDER BY ZohoID) as frontend_id,
        ZohoID,
        FullName
      FROM zoho_Employee 
      ORDER BY ZohoID
    `);
    
    console.log(`📊 Found ${allEmployees.recordset.length} total employees in Azure SQL`);
    
    // Clear existing incomplete mapping
    await pgPool.query('DELETE FROM employee_zoho_mapping');
    console.log('🗑️  Cleared incomplete mapping table');
    
    // Insert complete mapping for ALL employees
    let insertCount = 0;
    for (const emp of allEmployees.recordset) {
      await pgPool.query(`
        INSERT INTO employee_zoho_mapping (internal_id, zoho_id, employee_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (internal_id) DO UPDATE SET
          zoho_id = EXCLUDED.zoho_id,
          employee_name = EXCLUDED.employee_name
      `, [emp.frontend_id, emp.ZohoID, emp.FullName]);
      
      insertCount++;
      if (insertCount % 50 === 0) {
        console.log(`📝 Mapped ${insertCount} employees...`);
      }
    }
    
    console.log(`✅ Successfully created complete mapping for ${insertCount} employees`);
    
    // Verify critical employees are correctly mapped
    const criticalCheck = await pgPool.query(`
      SELECT 
        internal_id,
        zoho_id,
        employee_name
      FROM employee_zoho_mapping 
      WHERE employee_name IN (
        'Abdullah Wasi',
        'Shiva Abhimanyu',
        'Praveen M G',
        'Mohammad Abdul Wahab Khan',
        'Laxmi Pavani'
      )
      ORDER BY internal_id
    `);
    
    console.log('\n🎯 CRITICAL EMPLOYEE VERIFICATION:');
    console.log('=====================================');
    for (const emp of criticalCheck.rows) {
      console.log(`Frontend ID ${emp.internal_id}: ${emp.employee_name} (Zoho: ${emp.zoho_id})`);
    }
    
    // Check message attribution after complete mapping
    const messageCheck = await pgPool.query(`
      SELECT 
        ezm.internal_id,
        ezm.employee_name,
        ezm.zoho_id,
        COUNT(cm.id) as message_count
      FROM employee_zoho_mapping ezm
      LEFT JOIN chat_messages cm ON cm.employee_id = ezm.internal_id
      WHERE ezm.employee_name IN (
        'Abdullah Wasi',
        'Shiva Abhimanyu', 
        'Praveen M G',
        'Mohammad Abdul Wahab Khan'
      )
      GROUP BY ezm.internal_id, ezm.employee_name, ezm.zoho_id
      ORDER BY message_count DESC
    `);
    
    console.log('\n📊 MESSAGE ATTRIBUTION AFTER COMPLETE MAPPING:');
    console.log('===============================================');
    for (const emp of messageCheck.rows) {
      console.log(`${emp.employee_name} (ID: ${emp.internal_id}, Zoho: ${emp.zoho_id}): ${emp.message_count} messages`);
    }
    
    await azurePool.close();
    await pgPool.end();
    
    console.log('\n🎉 COMPLETE EMPLOYEE MAPPING SYNCHRONIZATION FINISHED');
    console.log('✅ Frontend should now display correct employee names for all chat messages');
    console.log('🔄 Please restart the workflow to apply changes');
    
  } catch (error) {
    console.error('❌ Error creating complete employee mapping:', error);
    await pgPool.end();
  }
}

fixCompleteEmployeeMapping();