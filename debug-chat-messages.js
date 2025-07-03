// Debug script to investigate chat message disappearing issue
import pkg from 'pg';
const { Pool } = pkg;

async function debugChatMessages() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Debugging Chat Messages - Investigation Report');
    console.log('='.repeat(60));

    // 1. Check total message count by date
    console.log('\n1. TOTAL MESSAGES BY DATE:');
    const messagesByDate = await pool.query(`
      SELECT 
        DATE(timestamp) as message_date,
        COUNT(*) as message_count,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM chat_messages 
      WHERE timestamp >= '2025-07-01'
      GROUP BY DATE(timestamp)
      ORDER BY message_date DESC;
    `);
    
    console.table(messagesByDate.rows);

    // 2. Check recent messages per employee
    console.log('\n2. RECENT MESSAGES PER EMPLOYEE (Top 20):');
    const recentByEmployee = await pool.query(`
      SELECT 
        employee_id,
        COUNT(*) as total_messages,
        MAX(timestamp) as last_message_date,
        MIN(timestamp) as first_message_date
      FROM chat_messages 
      WHERE timestamp >= '2025-07-01'
      GROUP BY employee_id
      ORDER BY total_messages DESC
      LIMIT 20;
    `);
    
    console.table(recentByEmployee.rows);

    // 3. Check for specific employees mentioned by users
    console.log('\n3. SPECIFIC EMPLOYEE MESSAGE HISTORY:');
    const specificEmployees = [42, 167, 156, 148, 139]; // Based on recent messages
    
    for (const empId of specificEmployees) {
      const empMessages = await pool.query(`
        SELECT 
          id,
          sender,
          content,
          timestamp,
          DATE(timestamp) as message_date
        FROM chat_messages 
        WHERE employee_id = $1
        ORDER BY timestamp DESC
        LIMIT 5;
      `, [empId]);
      
      console.log(`\nEmployee ${empId} Messages (Latest 5):`);
      empMessages.rows.forEach(msg => {
        console.log(`  [${msg.message_date}] ${msg.sender}: ${msg.content.substring(0, 50)}...`);
      });
    }

    // 4. Check database table structure and indexes
    console.log('\n4. DATABASE STRUCTURE:');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages'
      ORDER BY ordinal_position;
    `);
    
    console.table(tableInfo.rows);

    // 5. Check for any duplicate or corrupted data
    console.log('\n5. DATA QUALITY CHECK:');
    const dataQuality = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT id) as unique_ids,
        COUNT(CASE WHEN content IS NULL OR content = '' THEN 1 END) as empty_content,
        COUNT(CASE WHEN sender IS NULL OR sender = '' THEN 1 END) as empty_sender,
        COUNT(CASE WHEN timestamp IS NULL THEN 1 END) as null_timestamps
      FROM chat_messages;
    `);
    
    console.table(dataQuality.rows);

    // 6. Check system timezone and timestamps
    console.log('\n6. TIMESTAMP ANALYSIS:');
    const timestampInfo = await pool.query(`
      SELECT 
        'Current DB Time' as info,
        NOW() as value
      UNION ALL
      SELECT 
        'Latest Message Time' as info,
        MAX(timestamp) as value
      FROM chat_messages
      UNION ALL
      SELECT 
        'Oldest Message Time' as info,
        MIN(timestamp) as value
      FROM chat_messages;
    `);
    
    console.table(timestampInfo.rows);

    console.log('\n='.repeat(60));
    console.log('✅ Debug investigation complete');
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug function
debugChatMessages();