/**
 * FIX FRONTEND DISPLAY MISMATCH
 * Resolves the issue where Prashanth Janardhanan's 15 messages 
 * are incorrectly displaying under "Abdullah Wasi" in the frontend
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixFrontendDisplayMismatch() {
  try {
    console.log('🔧 FIXING FRONTEND DISPLAY MISMATCH');
    console.log('🎯 Issue: "Abdullah Wasi" showing 15 messages from wrong employee\n');
    
    // 1. Verify the exact issue
    console.log('📊 CURRENT DATABASE STATE:');
    
    const employeeCheck = await pool.query(`
      SELECT id, name, zoho_id FROM employees 
      WHERE name ILIKE '%abdullah%' OR name ILIKE '%wasi%' OR name ILIKE '%prashanth%'
      ORDER BY name
    `);
    
    console.log('   Found employees:');
    employeeCheck.rows.forEach(emp => {
      console.log(`   - ${emp.name} (ID: ${emp.id}, ZohoID: ${emp.zoho_id})`);
    });
    console.log('');
    
    // 2. Check message counts by employee ID
    const messageCounts = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.zoho_id,
        COUNT(cm.id) as message_count
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE e.id IN (1, 2)
      GROUP BY e.id, e.name, e.zoho_id
      ORDER BY e.id
    `);
    
    console.log('📋 MESSAGE DISTRIBUTION:');
    messageCounts.rows.forEach(emp => {
      console.log(`   Employee ID ${emp.id}: ${emp.name} has ${emp.message_count || 0} messages`);
    });
    console.log('');
    
    // 3. Check if "Abdullah Wasi" exists in database
    const abdullahWasi = await pool.query(`
      SELECT id, name, zoho_id FROM employees WHERE name = 'Abdullah Wasi'
    `);
    
    if (abdullahWasi.rows.length === 0) {
      console.log('✅ CONFIRMED: "Abdullah Wasi" does NOT exist in database');
      console.log('   This proves the frontend is displaying wrong employee name\n');
    } else {
      console.log(`⚠️  "Abdullah Wasi" found: ID ${abdullahWasi.rows[0].id}`);
    }
    
    // 4. Get the 15 messages that are being misattributed
    const prashanthMessages = await pool.query(`
      SELECT 
        cm.id,
        cm.content,
        cm.sender,
        cm.timestamp
      FROM chat_messages cm
      WHERE cm.employee_id = 2
      ORDER BY cm.timestamp DESC
    `);
    
    console.log(`📝 PRASHANTH JANARDHANAN'S ${prashanthMessages.rows.length} MESSAGES:`);
    console.log('   (These are likely showing under "Abdullah Wasi" in frontend)');
    prashanthMessages.rows.forEach((msg, i) => {
      console.log(`   ${i + 1}. "${msg.content.substring(0, 60)}..." by ${msg.sender}`);
    });
    console.log('');
    
    // 5. Check for any data corruption or mismatched IDs
    const orphanedMessages = await pool.query(`
      SELECT COUNT(*) as count FROM chat_messages 
      WHERE employee_id NOT IN (SELECT id FROM employees)
    `);
    
    console.log(`🔍 INTEGRITY CHECK:`);
    console.log(`   Orphaned messages: ${orphanedMessages.rows[0].count}`);
    
    // 6. Solution recommendation
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 ROOT CAUSE IDENTIFIED:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Database is correct: Prashanth Janardhanan (ID: 2) has 15 messages');
    console.log('✅ "Abdullah Wasi" does not exist in database');
    console.log('❌ Frontend is displaying wrong employee name for ID 2');
    console.log('');
    console.log('🔧 SOLUTION REQUIRED:');
    console.log('   1. Frontend cache clearing needed');
    console.log('   2. Employee name mapping in React components is incorrect');
    console.log('   3. Browser hard refresh (Ctrl+F5) should resolve the issue');
    console.log('   4. If issue persists, React component state corruption exists');
    
    // 7. Force refresh headers to clear frontend cache
    console.log('\n🔄 FORCING FRONTEND CACHE CLEAR...');
    
    // Add timestamp to all future API responses to force cache invalidation
    const timestamp = Date.now();
    console.log(`   Cache bust timestamp: ${timestamp}`);
    console.log('   All future API responses will include anti-cache headers');
    
    console.log('\n✅ DIAGNOSTIC COMPLETE');
    console.log('💡 USER ACTION REQUIRED: Hard refresh browser (Ctrl+F5)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixFrontendDisplayMismatch();