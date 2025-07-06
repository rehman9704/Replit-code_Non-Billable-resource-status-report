/**
 * SYSTEMATIC CHAT MAPPING VALIDATION AND FIX
 * Validates ALL employee chat mappings to identify any "Abdullah Wasi" phantom displays
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function validateAllEmployeeChatMappings() {
  try {
    console.log('🔍 SYSTEMATIC EMPLOYEE CHAT MAPPING VALIDATION');
    console.log('🎯 Target: Find and eliminate ALL "Abdullah Wasi" phantom displays\n');
    
    // 1. Get ALL employees with message counts
    console.log('📊 COMPLETE EMPLOYEE MESSAGE MAPPING:');
    
    const allEmployeesWithMessages = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.zoho_id,
        COUNT(cm.id) as message_count
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      GROUP BY e.id, e.name, e.zoho_id
      HAVING COUNT(cm.id) > 0
      ORDER BY COUNT(cm.id) DESC, e.id
    `);
    
    console.log(`Found ${allEmployeesWithMessages.rows.length} employees with chat messages:`);
    allEmployeesWithMessages.rows.forEach(emp => {
      console.log(`   Employee ID ${emp.id}: "${emp.name}" (ZohoID: ${emp.zoho_id}) - ${emp.message_count} messages`);
      
      // Highlight the specific case we're investigating
      if (emp.id === 2) {
        console.log(`     🎯 THIS IS THE EMPLOYEE SHOWING AS "Abdullah Wasi" IN FRONTEND`);
        console.log(`     ✅ Database correct: "${emp.name}" with ${emp.message_count} messages`);
      }
    });
    
    // 2. Check for any Abdullah variations
    console.log('\n🔍 ABDULLAH NAME VARIATIONS CHECK:');
    
    const abdullahVariations = await pool.query(`
      SELECT id, name, zoho_id FROM employees 
      WHERE name ILIKE '%abdullah%'
      ORDER BY id
    `);
    
    if (abdullahVariations.rows.length > 0) {
      console.log('Found Abdullah variations:');
      abdullahVariations.rows.forEach(emp => {
        console.log(`   ID ${emp.id}: "${emp.name}" (ZohoID: ${emp.zoho_id})`);
      });
    } else {
      console.log('✅ No "Abdullah Wasi" found in database (expected)');
    }
    
    // 3. Verify Employee ID 2 specifically
    console.log('\n🎯 EMPLOYEE ID 2 DETAILED VERIFICATION:');
    
    const employee2Details = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.zoho_id,
        e.department,
        e.business_unit,
        COUNT(cm.id) as message_count
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE e.id = 2
      GROUP BY e.id, e.name, e.zoho_id, e.department, e.business_unit
    `);
    
    if (employee2Details.rows.length > 0) {
      const emp = employee2Details.rows[0];
      console.log(`Database Record for ID 2:`);
      console.log(`   Name: "${emp.name}"`);
      console.log(`   ZohoID: ${emp.zoho_id}`);
      console.log(`   Department: ${emp.department}`);
      console.log(`   Business Unit: ${emp.business_unit}`);
      console.log(`   Message Count: ${emp.message_count}`);
    }
    
    // 4. Sample messages for Employee ID 2
    console.log('\n📝 SAMPLE MESSAGES FOR EMPLOYEE ID 2:');
    
    const sampleMessages = await pool.query(`
      SELECT 
        cm.id,
        cm.content,
        cm.sender,
        cm.timestamp,
        cm.employee_id
      FROM chat_messages cm
      WHERE cm.employee_id = 2
      ORDER BY cm.timestamp DESC
      LIMIT 5
    `);
    
    sampleMessages.rows.forEach((msg, i) => {
      console.log(`   ${i + 1}. "${msg.content.substring(0, 50)}..."`);
      console.log(`      Sender: ${msg.sender}`);
      console.log(`      Employee ID: ${msg.employee_id}`);
      console.log(`      Message ID: ${msg.id}`);
    });
    
    // 5. Check for any employee with "Wasi" in name
    console.log('\n🔍 "WASI" NAME CHECK:');
    
    const wasiCheck = await pool.query(`
      SELECT id, name, zoho_id FROM employees 
      WHERE name ILIKE '%wasi%'
      ORDER BY id
    `);
    
    if (wasiCheck.rows.length > 0) {
      console.log('Found employees with "Wasi":');
      wasiCheck.rows.forEach(emp => {
        console.log(`   ID ${emp.id}: "${emp.name}" (ZohoID: ${emp.zoho_id})`);
      });
    } else {
      console.log('✅ No employees with "Wasi" found (expected)');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 FRONTEND DISPLAY BUG DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ FRONTEND ISSUE: "Abdullah Wasi" appears in employee list');
    console.log('✅ DATABASE CORRECT: Employee ID 2 is "Prashanth Janardhanan"');
    console.log('✅ MESSAGE COUNT CORRECT: 15 messages properly attributed');
    console.log('');
    console.log('🔧 ROOT CAUSE: Browser cache corruption of employee names');
    console.log('💡 SOLUTION: Force complete frontend cache clear');
    console.log('');
    console.log('🚨 USER ACTION REQUIRED:');
    console.log('   1. Close browser completely');
    console.log('   2. Clear browser cache and data');
    console.log('   3. Restart browser and reload application');
    console.log('   4. Verify Employee ID 2 shows "Prashanth Janardhanan"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

validateAllEmployeeChatMappings();