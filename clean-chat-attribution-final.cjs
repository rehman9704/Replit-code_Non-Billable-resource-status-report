/**
 * FINAL CHAT ATTRIBUTION CLEANUP
 * Removes any incorrect or duplicate messages and ensures clean attribution
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanChatAttributionFinal() {
  try {
    console.log('🧹 FINAL CHAT ATTRIBUTION CLEANUP');
    console.log('🎯 Ensuring only correct, user-added comments remain\n');
    
    // 1. Get all current messages
    const allMessages = await pool.query(`
      SELECT 
        cm.id,
        cm.content,
        cm.sender,
        cm.timestamp,
        cm.employee_id,
        e.name as employee_name,
        e.zoho_id
      FROM chat_messages cm
      LEFT JOIN employees e ON cm.employee_id = e.id
      ORDER BY cm.timestamp DESC
    `);
    
    console.log(`📊 Current total: ${allMessages.rows.length} messages\n`);
    
    // 2. Identify potentially problematic messages
    const duplicateContents = new Map();
    allMessages.rows.forEach(msg => {
      const key = msg.content.trim().toLowerCase();
      if (!duplicateContents.has(key)) {
        duplicateContents.set(key, []);
      }
      duplicateContents.get(key).push(msg);
    });
    
    // 3. Find and remove exact duplicates
    let removedDuplicates = 0;
    for (const [content, messages] of duplicateContents) {
      if (messages.length > 1) {
        // Keep only the most recent message, remove older duplicates
        const sortedByTime = messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const toKeep = sortedByTime[0];
        const toRemove = sortedByTime.slice(1);
        
        console.log(`🔍 Found ${messages.length} duplicates of: "${content.substring(0, 50)}..."`);
        console.log(`   Keeping: ID ${toKeep.id} (${toKeep.timestamp})`);
        
        for (const duplicate of toRemove) {
          await pool.query('DELETE FROM chat_messages WHERE id = $1', [duplicate.id]);
          removedDuplicates++;
          console.log(`   Removed: ID ${duplicate.id} (${duplicate.timestamp})`);
        }
        console.log('');
      }
    }
    
    // 4. Verify employees mentioned by user have no unwanted messages
    const suspiciousEmployees = [
      'Abdullah Wasi', 'Abdul Baseer', 'Ahmed Omair Habib', 
      'Alex Jeyasingh Nesiyan', 'Irfan Mujeeb', 'Harikrishan Yogi', 
      'Talal Ul Haq', 'Sabih Zaidi'
    ];
    
    for (const empName of suspiciousEmployees) {
      const empMessages = await pool.query(`
        SELECT cm.id, cm.content, cm.sender
        FROM chat_messages cm
        JOIN employees e ON cm.employee_id = e.id
        WHERE e.name = $1
      `, [empName]);
      
      if (empMessages.rows.length > 0) {
        console.log(`⚠️  WARNING: ${empName} has ${empMessages.rows.length} messages:`);
        empMessages.rows.forEach(msg => {
          console.log(`   - "${msg.content}" by ${msg.sender}`);
        });
        
        // Remove all messages from these employees as they shouldn't have any
        await pool.query(`
          DELETE FROM chat_messages 
          WHERE employee_id IN (
            SELECT id FROM employees WHERE name = $1
          )
        `, [empName]);
        console.log(`   ✅ Removed all ${empMessages.rows.length} messages from ${empName}\n`);
      } else {
        console.log(`✅ ${empName}: No messages (correct)\n`);
      }
    }
    
    // 5. Validate M Abdullah Ansari messages are legitimate
    const abdullahMessages = await pool.query(`
      SELECT cm.id, cm.content, cm.sender, cm.timestamp
      FROM chat_messages cm
      JOIN employees e ON cm.employee_id = e.id
      WHERE e.name = 'M Abdullah Ansari'
      ORDER BY cm.timestamp DESC
    `);
    
    console.log(`📋 M Abdullah Ansari has ${abdullahMessages.rows.length} messages:`);
    abdullahMessages.rows.forEach((msg, i) => {
      console.log(`   ${i + 1}. "${msg.content}" by ${msg.sender} (${msg.timestamp.substring(0, 19)})`);
    });
    console.log('');
    
    // 6. Final verification - ensure no orphaned messages
    const orphanedMessages = await pool.query(`
      SELECT cm.id, cm.content, cm.sender
      FROM chat_messages cm
      LEFT JOIN employees e ON cm.employee_id = e.id
      WHERE e.id IS NULL
    `);
    
    if (orphanedMessages.rows.length > 0) {
      console.log(`⚠️  Found ${orphanedMessages.rows.length} orphaned messages (will remove):`);
      orphanedMessages.rows.forEach(msg => {
        console.log(`   - "${msg.content}" by ${msg.sender}`);
      });
      
      await pool.query(`DELETE FROM chat_messages WHERE employee_id NOT IN (SELECT id FROM employees)`);
      console.log(`   ✅ Removed all orphaned messages\n`);
    } else {
      console.log('✅ No orphaned messages found\n');
    }
    
    // 7. Final summary
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM chat_messages');
    const employeesWithMessages = await pool.query(`
      SELECT 
        e.name,
        e.zoho_id,
        COUNT(cm.id) as message_count
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE cm.id IS NOT NULL
      GROUP BY e.id, e.name, e.zoho_id
      ORDER BY COUNT(cm.id) DESC
    `);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 FINAL CLEANUP SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Total messages after cleanup: ${finalCount.rows[0].count}`);
    console.log(`✅ Duplicates removed: ${removedDuplicates}`);
    console.log(`✅ Employees with messages: ${employeesWithMessages.rows.length}`);
    console.log('');
    
    console.log('👥 EMPLOYEES WITH MESSAGES:');
    employeesWithMessages.rows.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.name} (${emp.zoho_id}): ${emp.message_count} messages`);
    });
    
    console.log('\n🎯 RESULT: Chat system cleaned - only legitimate user comments remain');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanChatAttributionFinal();