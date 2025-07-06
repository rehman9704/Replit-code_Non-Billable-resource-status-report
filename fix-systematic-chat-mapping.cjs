/**
 * Systematic Chat Message Attribution Fix
 * Identifies and resolves all placeholder employee records with chat messages
 */

const { Pool } = require('pg');

const pgConfig = {
  connectionString: process.env.DATABASE_URL
};

async function fixSystematicChatMapping() {
  const pgPool = new Pool(pgConfig);
  
  try {
    console.log('🔍 Systematic analysis of chat message attribution issues...\n');
    
    // Step 1: Find all placeholder employees with chat messages
    console.log('📋 Finding placeholder employees with chat messages...');
    const placeholderQuery = await pgPool.query(`
      SELECT DISTINCT e.id, e.name, e.zoho_id, COUNT(cm.id) as message_count
      FROM employees e
      INNER JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE e.name LIKE 'Employee_%' OR e.zoho_id LIKE 'ZOHO_%'
      GROUP BY e.id, e.name, e.zoho_id
      ORDER BY e.id
    `);
    
    console.log(`Found ${placeholderQuery.rows.length} placeholder employees with chat messages:`);
    placeholderQuery.rows.forEach(emp => {
      console.log(`  - Employee ${emp.id}: "${emp.name}" (${emp.zoho_id}) - ${emp.message_count} messages`);
    });
    
    // Step 2: Show sample messages for each placeholder
    console.log('\n📱 Sample messages for each placeholder employee:');
    for (const emp of placeholderQuery.rows) {
      const messages = await pgPool.query(
        'SELECT id, content, timestamp FROM chat_messages WHERE employee_id = $1 ORDER BY timestamp DESC LIMIT 3',
        [emp.id]
      );
      
      console.log(`\nEmployee ${emp.id} (${emp.name}):`);
      messages.rows.forEach(msg => {
        console.log(`  - "${msg.content.substring(0, 80)}..." (${msg.timestamp.toISOString().substring(0, 10)})`);
      });
    }
    
    // Step 3: Analysis of real employees without messages
    console.log('\n🔍 Finding real employees without chat messages...');
    const availableEmployees = await pgPool.query(`
      SELECT e.id, e.name, e.zoho_id
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE cm.employee_id IS NULL 
        AND e.name NOT LIKE 'Employee_%' 
        AND e.zoho_id NOT LIKE 'ZOHO_%'
        AND e.zoho_id IS NOT NULL
        AND e.zoho_id != ''
      ORDER BY e.id
      LIMIT 10
    `);
    
    console.log(`Found ${availableEmployees.rows.length} real employees without chat messages:`);
    availableEmployees.rows.forEach(emp => {
      console.log(`  - Employee ${emp.id}: "${emp.name}" (${emp.zoho_id})`);
    });
    
    // Step 4: Check for employees with high-number IDs that might have messages
    console.log('\n🔍 Checking high-number employee IDs with chat messages...');
    const highNumberEmployees = await pgPool.query(`
      SELECT DISTINCT cm.employee_id, COUNT(cm.id) as message_count
      FROM chat_messages cm
      LEFT JOIN employees e ON cm.employee_id = e.id
      WHERE cm.employee_id > 200 OR e.id IS NULL
      GROUP BY cm.employee_id
      ORDER BY cm.employee_id
    `);
    
    if (highNumberEmployees.rows.length > 0) {
      console.log(`Found ${highNumberEmployees.rows.length} messages attributed to high-number/missing employee IDs:`);
      highNumberEmployees.rows.forEach(emp => {
        console.log(`  - Employee ID ${emp.employee_id}: ${emp.message_count} messages`);
      });
      
      // Show sample messages for high-number IDs
      console.log('\n📱 Sample messages for high-number employee IDs:');
      for (const emp of highNumberEmployees.rows.slice(0, 5)) {
        const messages = await pgPool.query(
          'SELECT id, content, timestamp FROM chat_messages WHERE employee_id = $1 ORDER BY timestamp DESC LIMIT 2',
          [emp.employee_id]
        );
        
        console.log(`\nEmployee ID ${emp.employee_id}:`);
        messages.rows.forEach(msg => {
          console.log(`  - "${msg.content.substring(0, 60)}..." (${msg.timestamp.toISOString().substring(0, 10)})`);
        });
      }
    } else {
      console.log('✅ No orphaned messages found in high-number employee IDs');
    }
    
    // Step 5: Summary and recommendations
    console.log('\n📊 SUMMARY AND RECOMMENDATIONS:');
    console.log('===============================================');
    
    const totalPlaceholderMessages = placeholderQuery.rows.reduce((sum, emp) => sum + parseInt(emp.message_count), 0);
    console.log(`📌 Total messages in placeholder employees: ${totalPlaceholderMessages}`);
    console.log(`📌 Available real employee records: ${availableEmployees.rows.length}`);
    
    if (totalPlaceholderMessages > 0) {
      console.log('\n🚨 RECOMMENDED ACTIONS:');
      console.log('1. Map placeholder employees to real employee records using authentic Zoho IDs');
      console.log('2. Update employee records with correct names and Zoho IDs from Azure SQL');
      console.log('3. Redistribute messages from high-number employee IDs to proper records');
      console.log('4. Ensure all chat messages are attributed to authenticated employee records');
    } else {
      console.log('\n✅ All chat messages appear to be properly attributed to real employees');
    }
    
    // Step 6: Check current status after Praveen fix
    console.log('\n🔍 Current status after Praveen M G fix:');
    const praveenCheck = await pgPool.query(
      'SELECT id, name, zoho_id FROM employees WHERE id = 80'
    );
    
    if (praveenCheck.rows.length > 0) {
      console.log(`Employee 80: ${praveenCheck.rows[0].name} (${praveenCheck.rows[0].zoho_id})`);
      
      const praveenMessages = await pgPool.query(
        'SELECT COUNT(*) as count FROM chat_messages WHERE employee_id = 80'
      );
      console.log(`Messages: ${praveenMessages.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pgPool.end();
  }
}

fixSystematicChatMapping();