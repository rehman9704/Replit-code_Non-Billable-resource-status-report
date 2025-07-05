/**
 * CRITICAL FIX: Complete Employee Mapping using Storage System
 * Fixes frontend display by creating comprehensive ZOHO ID mapping for ALL employees
 * 
 * ISSUE: Abdullah Wasi incorrectly showing 92 messages that belong to Shiva Abhimanyu
 * SOLUTION: Create complete mapping using storage.getEmployees() that matches frontend IDs
 */

const { Pool } = require('@neondatabase/serverless');

async function fixEmployeeMappingViaStorage() {
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔄 CREATING COMPLETE EMPLOYEE MAPPING VIA STORAGE SYSTEM');
    
    // Import and use the storage system to get all employees
    const { storage } = await import('./server/storage.js');
    
    // Get ALL employees using the same system the frontend uses
    const result = await storage.getEmployees({ 
      page: 1, 
      pageSize: 1000  // Get all employees
    });
    
    console.log(`📊 Found ${result.data.length} employees via storage system`);
    
    // Clear existing incomplete mapping
    await pgPool.query('DELETE FROM employee_zoho_mapping');
    console.log('🗑️  Cleared incomplete mapping table');
    
    // Insert complete mapping for ALL employees using their actual frontend IDs
    let insertCount = 0;
    for (const emp of result.data) {
      await pgPool.query(`
        INSERT INTO employee_zoho_mapping (internal_id, zoho_id, employee_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (internal_id) DO UPDATE SET
          zoho_id = EXCLUDED.zoho_id,
          employee_name = EXCLUDED.employee_name
      `, [emp.id, emp.zohoId, emp.name]);
      
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
    
    // Specifically check which employee is at frontend ID 2 (the 92 message employee)
    const employeeId2Check = await pgPool.query(`
      SELECT 
        internal_id,
        zoho_id,
        employee_name
      FROM employee_zoho_mapping 
      WHERE internal_id = 2
    `);
    
    console.log('\n⚠️  EMPLOYEE AT FRONTEND ID 2 (the 92 message employee):');
    console.log('=========================================================');
    if (employeeId2Check.rows.length > 0) {
      const emp = employeeId2Check.rows[0];
      console.log(`Frontend ID 2: ${emp.employee_name} (Zoho: ${emp.zoho_id})`);
      console.log('This employee should have 92 messages, NOT Abdullah Wasi!');
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
      WHERE cm.id IS NOT NULL
      GROUP BY ezm.internal_id, ezm.employee_name, ezm.zoho_id
      ORDER BY message_count DESC
    `);
    
    console.log('\n📊 MESSAGE ATTRIBUTION AFTER COMPLETE MAPPING:');
    console.log('===============================================');
    for (const emp of messageCheck.rows) {
      console.log(`${emp.employee_name} (ID: ${emp.internal_id}, Zoho: ${emp.zoho_id}): ${emp.message_count} messages`);
    }
    
    await pgPool.end();
    
    console.log('\n🎉 COMPLETE EMPLOYEE MAPPING SYNCHRONIZATION FINISHED');
    console.log('✅ Frontend should now display correct employee names for all chat messages');
    console.log('🔄 Please restart the workflow to apply changes');
    
  } catch (error) {
    console.error('❌ Error creating complete employee mapping:', error);
    await pgPool.end();
  }
}

fixEmployeeMappingViaStorage();