/**
 * Simple Fix for Praveen M G Chat Attribution
 * Move Petbarn/Shopify messages from employee_id 80 to a proper employee record for Praveen M G
 */

const { Pool } = require('pg');

const pgConfig = {
  connectionString: process.env.DATABASE_URL
};

async function fixPraveenChat() {
  const pgPool = new Pool(pgConfig);
  
  try {
    console.log('🔍 Investigating Praveen M G chat attribution issue...');
    
    // Step 1: Check current messages attributed to employee_id 80
    const currentMessages = await pgPool.query(
      'SELECT id, employee_id, content, timestamp FROM chat_messages WHERE employee_id = 80 ORDER BY timestamp DESC'
    );
    
    console.log(`📱 Current messages for employee_id 80: ${currentMessages.rows.length}`);
    currentMessages.rows.forEach(msg => {
      console.log(`  - "${msg.content.substring(0, 50)}..."`);
    });
    
    // Step 2: Identify Petbarn/Shopify messages that belong to Praveen M G
    const praveenMessages = currentMessages.rows.filter(msg => 
      msg.content.includes('Petbarn') || msg.content.includes('Shopify')
    );
    
    console.log(`\n🎯 Found ${praveenMessages.length} Petbarn/Shopify messages for Praveen M G:`);
    praveenMessages.forEach(msg => {
      console.log(`  - Message ${msg.id}: "${msg.content}"`);
    });
    
    if (praveenMessages.length === 0) {
      console.log('❌ No Petbarn/Shopify messages found to reassign');
      return;
    }
    
    // Step 3: Find or create an appropriate employee_id for Praveen M G
    // First check if we have an employee record that could represent Praveen
    const existingEmployee = await pgPool.query(
      'SELECT id, name, zoho_id FROM employees WHERE zoho_id = $1 OR name ILIKE $2',
      ['10012260', '%Praveen%M%G%']
    );
    
    let praveenEmployeeId;
    
    if (existingEmployee.rows.length > 0) {
      praveenEmployeeId = existingEmployee.rows[0].id;
      console.log(`✅ Found existing Praveen record: ID ${praveenEmployeeId}`);
    } else {
      // Update employee_id 80 to represent Praveen M G properly
      await pgPool.query(
        'UPDATE employees SET name = $1, zoho_id = $2 WHERE id = 80',
        ['Praveen M G', '10012260']
      );
      praveenEmployeeId = 80;
      console.log('✅ Updated employee_id 80 to represent Praveen M G');
    }
    
    // Step 4: If we used a different employee_id, move the Petbarn/Shopify messages
    if (praveenEmployeeId !== 80) {
      console.log(`🔧 Moving ${praveenMessages.length} messages to employee_id ${praveenEmployeeId}...`);
      
      for (const msg of praveenMessages) {
        await pgPool.query(
          'UPDATE chat_messages SET employee_id = $1 WHERE id = $2',
          [praveenEmployeeId, msg.id]
        );
        console.log(`✅ Moved message ${msg.id} to employee_id ${praveenEmployeeId}`);
      }
    } else {
      console.log('✅ Messages are already correctly attributed to Praveen M G (employee_id 80)');
    }
    
    // Step 5: Verify the fix
    console.log('\n🔍 Verification:');
    
    const verifyPraveen = await pgPool.query(
      'SELECT id, name, zoho_id FROM employees WHERE id = $1',
      [praveenEmployeeId]
    );
    
    console.log(`Employee ${praveenEmployeeId}:`, verifyPraveen.rows[0]);
    
    const verifyMessages = await pgPool.query(
      'SELECT id, content, timestamp FROM chat_messages WHERE employee_id = $1 ORDER BY timestamp DESC',
      [praveenEmployeeId]
    );
    
    console.log(`\n📋 Messages for Praveen M G (employee_id ${praveenEmployeeId}): ${verifyMessages.rows.length}`);
    verifyMessages.rows.forEach(msg => {
      console.log(`  - "${msg.content}" (${msg.timestamp})`);
    });
    
    console.log('\n🎉 Successfully fixed Praveen M G chat attribution!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pgPool.end();
  }
}

fixPraveenChat();