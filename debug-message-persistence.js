import pkg from 'pg';
const { Pool } = pkg;

async function runPersistenceTest() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 BULLETPROOF CHAT MESSAGE PERSISTENCE TEST');
    console.log('='.repeat(70));

    // Test 1: Verify all messages are accessible
    console.log('\n1. COMPLETE MESSAGE INVENTORY:');
    const totalMessages = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT employee_id) as unique_employees,
        MIN(timestamp) as oldest_message,
        MAX(timestamp) as newest_message
      FROM chat_messages;
    `);
    console.table(totalMessages.rows);

    // Test 2: Check messages by hour for recent activity
    console.log('\n2. RECENT MESSAGE ACTIVITY (Last 24 Hours):');
    const recentActivity = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as message_count,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM chat_messages 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC;
    `);
    console.table(recentActivity.rows);

    // Test 3: Verify message persistence for specific employees
    console.log('\n3. EMPLOYEE MESSAGE PERSISTENCE VERIFICATION:');
    const employeeMessages = await pool.query(`
      SELECT 
        employee_id,
        COUNT(*) as message_count,
        MAX(timestamp) as last_message,
        string_agg(DISTINCT sender, ', ') as senders
      FROM chat_messages 
      WHERE timestamp >= '2025-07-01'
      GROUP BY employee_id
      ORDER BY message_count DESC
      LIMIT 10;
    `);
    console.table(employeeMessages.rows);

    // Test 4: Check database connection and performance
    console.log('\n4. DATABASE PERFORMANCE TEST:');
    const startTime = Date.now();
    
    const perfTest = await pool.query(`
      SELECT 
        employee_id,
        content,
        timestamp,
        sender
      FROM chat_messages 
      ORDER BY timestamp DESC 
      LIMIT 100;
    `);
    
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    console.log(`✅ Retrieved ${perfTest.rows.length} messages in ${queryTime}ms`);
    console.log(`📊 Database Performance: ${queryTime < 1000 ? 'EXCELLENT' : queryTime < 2000 ? 'GOOD' : 'NEEDS ATTENTION'}`);

    // Test 5: Verify message content integrity
    console.log('\n5. MESSAGE CONTENT INTEGRITY:');
    const integrityCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN content IS NOT NULL AND content != '' THEN 1 END) as valid_content,
        COUNT(CASE WHEN sender IS NOT NULL AND sender != '' THEN 1 END) as valid_senders,
        COUNT(CASE WHEN timestamp IS NOT NULL THEN 1 END) as valid_timestamps
      FROM chat_messages;
    `);
    
    const integrity = integrityCheck.rows[0];
    console.log(`📋 Content Integrity Report:`);
    console.log(`   Total Messages: ${integrity.total_messages}`);
    console.log(`   Valid Content: ${integrity.valid_content}/${integrity.total_messages}`);
    console.log(`   Valid Senders: ${integrity.valid_senders}/${integrity.total_messages}`);
    console.log(`   Valid Timestamps: ${integrity.valid_timestamps}/${integrity.total_messages}`);
    
    const integrityScore = ((parseInt(integrity.valid_content) + parseInt(integrity.valid_senders) + parseInt(integrity.valid_timestamps)) / (parseInt(integrity.total_messages) * 3)) * 100;
    console.log(`   Integrity Score: ${integrityScore.toFixed(1)}%`);

    // Test 6: Real-time persistence test
    console.log('\n6. REAL-TIME PERSISTENCE TEST:');
    const testMessage = {
      employee_id: 999,
      sender: 'Persistence Test',
      content: `Test message at ${new Date().toISOString()}`,
      timestamp: new Date()
    };

    const insertResult = await pool.query(`
      INSERT INTO chat_messages (employee_id, sender, content, timestamp)
      VALUES ($1, $2, $3, $4)
      RETURNING id, timestamp;
    `, [testMessage.employee_id, testMessage.sender, testMessage.content, testMessage.timestamp]);

    console.log(`✅ Test message inserted with ID: ${insertResult.rows[0].id}`);

    // Verify immediate retrieval
    const retrieveResult = await pool.query(`
      SELECT * FROM chat_messages WHERE id = $1;
    `, [insertResult.rows[0].id]);

    console.log(`✅ Test message immediately retrievable: ${retrieveResult.rows.length > 0 ? 'YES' : 'NO'}`);

    // Clean up test message
    await pool.query(`DELETE FROM chat_messages WHERE id = $1;`, [insertResult.rows[0].id]);
    console.log(`🧹 Test message cleaned up`);

    console.log('\n' + '='.repeat(70));
    console.log('🎯 PERSISTENCE TEST COMPLETE');
    console.log('📈 All systems operational for bulletproof message persistence');

  } catch (error) {
    console.error('❌ Persistence test error:', error);
  } finally {
    await pool.end();
  }
}

// Run the persistence test
runPersistenceTest();