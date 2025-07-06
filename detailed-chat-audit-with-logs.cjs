/**
 * Detailed Chat Audit with Message Origins
 * Analyzes each chat message to understand when, where, who added comments
 * and provides proper attribution based on actual entry logs
 */

const { Pool } = require('pg');

async function detailedChatAuditWithLogs() {
  console.log('🔍 DETAILED CHAT AUDIT WITH MESSAGE ORIGINS');
  console.log('============================================');
  
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('📊 STEP 1: Complete Chat Message Analysis with Origins');
    
    // Get all chat messages with detailed information
    const allMessagesQuery = `
      SELECT id, employee_id, sender, content, timestamp 
      FROM chat_messages 
      ORDER BY timestamp DESC, id DESC
    `;
    
    const allMessages = await pgPool.query(allMessagesQuery);
    console.log(`\n✅ Found ${allMessages.rows.length} total chat messages\n`);
    
    // Group messages by sender to understand who added what
    const messagesBySender = {};
    const messagesByEmployee = {};
    
    allMessages.rows.forEach(msg => {
      // Group by sender
      if (!messagesBySender[msg.sender]) {
        messagesBySender[msg.sender] = [];
      }
      messagesBySender[msg.sender].push(msg);
      
      // Group by current employee assignment
      if (!messagesByEmployee[msg.employee_id]) {
        messagesByEmployee[msg.employee_id] = [];
      }
      messagesByEmployee[msg.employee_id].push(msg);
    });
    
    console.log('📋 MESSAGES BY SENDER (Who Added Comments):');
    console.log('==========================================');
    Object.keys(messagesBySender).forEach(sender => {
      const messages = messagesBySender[sender];
      console.log(`\n👤 ${sender}: ${messages.length} messages`);
      
      // Show timeline of messages by this sender
      messages.forEach((msg, index) => {
        const shortContent = msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
        console.log(`  ${index + 1}. [ID: ${msg.id}] [Employee: ${msg.employee_id}] [${msg.timestamp.toISOString().substring(0, 19)}]`);
        console.log(`      "${shortContent}"`);
      });
    });
    
    console.log('\n📋 CURRENT EMPLOYEE ASSIGNMENTS:');
    console.log('=================================');
    Object.keys(messagesByEmployee).forEach(employeeId => {
      const messages = messagesByEmployee[employeeId];
      console.log(`\n🏢 Employee ID ${employeeId}: ${messages.length} messages`);
      
      // Show who added messages for this employee
      const senderCounts = {};
      messages.forEach(msg => {
        senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
      });
      
      console.log(`   Senders: ${Object.entries(senderCounts).map(([sender, count]) => `${sender} (${count})`).join(', ')}`);
      
      // Show sample messages
      messages.slice(0, 3).forEach(msg => {
        const shortContent = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
        console.log(`   - "${shortContent}" (${msg.sender})`);
      });
    });
    
    console.log('\n📊 STEP 2: Analyzing Praveen M G Attribution Issue');
    
    // Current Praveen M G messages (Employee ID 80)
    const praveenMessages = messagesByEmployee[80] || [];
    console.log(`\n🔍 Current Employee ID 80 (Praveen M G): ${praveenMessages.length} messages`);
    
    if (praveenMessages.length > 0) {
      console.log('\nDetailed breakdown:');
      praveenMessages.forEach((msg, index) => {
        console.log(`\n${index + 1}. Message ID: ${msg.id}`);
        console.log(`   Sender: ${msg.sender}`);
        console.log(`   Timestamp: ${msg.timestamp.toISOString()}`);
        console.log(`   Content: "${msg.content}"`);
        console.log(`   ❓ Question: Did ${msg.sender} actually enter this comment for Praveen M G?`);
      });
    }
    
    console.log('\n📊 STEP 3: Message Content Analysis for Proper Attribution');
    
    // Look for messages that mention specific employee names or contexts
    const namePatterns = [
      { name: 'Praveen', pattern: /praveen/i },
      { name: 'Muhammad Bilal', pattern: /muhammad|bilal/i },
      { name: 'Laxmi', pattern: /laxmi/i },
      { name: 'Pet Barn', pattern: /pet.?barn|petbarn/i },
      { name: 'Shopify', pattern: /shopify/i },
      { name: 'Optimizely', pattern: /optimizely/i }
    ];
    
    console.log('\n🔍 Messages mentioning specific contexts:');
    namePatterns.forEach(pattern => {
      const matchingMessages = allMessages.rows.filter(msg => pattern.pattern.test(msg.content));
      if (matchingMessages.length > 0) {
        console.log(`\n📌 ${pattern.name}-related messages (${matchingMessages.length}):`);
        matchingMessages.forEach(msg => {
          console.log(`   - [ID: ${msg.id}] [Employee: ${msg.employee_id}] "${msg.content.substring(0, 80)}..." (${msg.sender})`);
        });
      }
    });
    
    console.log('\n📊 STEP 4: Timeline Analysis');
    
    // Show chronological order to understand message flow
    const chronologicalMessages = [...allMessages.rows].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log('\n⏰ Chronological Message Timeline:');
    chronologicalMessages.forEach((msg, index) => {
      const date = msg.timestamp.toISOString().substring(0, 19).replace('T', ' ');
      const shortContent = msg.content.length > 40 ? msg.content.substring(0, 40) + '...' : msg.content;
      console.log(`${index + 1}. [${date}] ID:${msg.id} → Employee:${msg.employee_id} by ${msg.sender}`);
      console.log(`   "${shortContent}"`);
    });
    
    console.log('\n📊 STEP 5: Recommendations for Correct Attribution');
    
    console.log('\n💡 Based on the analysis:');
    console.log('1. Messages should be attributed based on who actually entered them');
    console.log('2. Content context should match the intended employee');
    console.log('3. Timeline should reflect actual entry dates');
    console.log('4. Cross-reference with user reports about who entered what');
    
    return {
      totalMessages: allMessages.rows.length,
      messagesBySender: Object.keys(messagesBySender).map(sender => ({
        sender,
        count: messagesBySender[sender].length,
        messages: messagesBySender[sender]
      })),
      messagesByEmployee: Object.keys(messagesByEmployee).map(empId => ({
        employeeId: empId,
        count: messagesByEmployee[empId].length,
        messages: messagesByEmployee[empId]
      })),
      praveenMessages: praveenMessages,
      chronologicalOrder: chronologicalMessages
    };
    
  } catch (error) {
    console.error('💥 Error in detailed audit:', error);
    return { success: false, error: error.message };
  } finally {
    await pgPool.end();
  }
}

// Run the detailed audit
detailedChatAuditWithLogs().then(result => {
  if (result.success !== false) {
    console.log('\n🎯 AUDIT COMPLETE');
    console.log('=================');
    console.log(`✅ Analyzed ${result.totalMessages} messages`);
    console.log(`✅ Found ${result.messagesBySender.length} different senders`);
    console.log(`✅ Messages currently assigned to ${result.messagesByEmployee.length} employees`);
    
    console.log('\n📋 NEXT ACTIONS NEEDED:');
    console.log('1. Review the timeline and sender analysis');
    console.log('2. Correct attributions based on who actually entered comments');
    console.log('3. Ensure content context matches intended employees');
    console.log('4. Regenerate Excel with accurate attributions');
  }
}).catch(console.error);