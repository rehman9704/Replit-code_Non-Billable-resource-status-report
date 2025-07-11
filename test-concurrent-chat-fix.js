/**
 * TEST: ULTIMATE Chat History Fix
 * Tests both Prashanth Janardhanan and Prabhjas Singh Bajwa for concurrent comment handling
 */

async function testConcurrentChatFix() {
  console.log('🧪 TESTING: ULTIMATE Chat History Fix');
  console.log('==========================================');
  
  // Test with Prashanth Janardhanan (user reported issue)
  await testEmployeeChatHistory('10000391', 'Prashanth Janardhanan');
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test with Prabhjas Singh Bajwa (previous issue)
  await testEmployeeChatHistory('10013034', 'Prabhjas Singh Bajwa');
}

async function testEmployeeChatHistory(zohoId, employeeName) {
  console.log(`\n📝 TESTING EMPLOYEE: ${employeeName} (${zohoId})`);
  console.log('-'.repeat(40));
  
  try {
    // Check current state first
    console.log('📊 Checking current state...');
    const initialCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
    const initialData = await initialCheck.json();
    const initialCount = initialData.chatHistory?.length || 0;
    console.log(`   Current messages: ${initialCount}`);
    
    // Test 1: Add first comment
    console.log('\n📝 Test 1: First user adds comment...');
    const comment1 = `Performance review scheduled for ${employeeName}. Current status: Under evaluation.`;
    const user1 = "Muhammad Rehman Shahid";
    
    const response1 = await fetch('http://localhost:5000/api/live-chat-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zohoId: zohoId,
        comments: comment1,
        commentsEnteredBy: user1
      })
    });
    
    const result1 = await response1.json();
    console.log('✅ First comment result:', result1.success);
    
    // Check state after first comment
    const check1 = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
    const data1 = await check1.json();
    console.log(`📊 After first comment: ${data1.chatHistory?.length || 0} messages in history`);
    
    // Test 2: Add second comment (simulating concurrent user)
    console.log('\n📝 Test 2: Second user adds comment...');
    const comment2 = `Updated assignment for ${employeeName}. New project allocation confirmed.`;
    const user2 = "Timesheet Admin";
    
    const response2 = await fetch('http://localhost:5000/api/live-chat-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zohoId: zohoId,
        comments: comment2,
        commentsEnteredBy: user2
      })
    });
    
    const result2 = await response2.json();
    console.log('✅ Second comment result:', result2.success);
    
    // Check state after second comment
    const check2 = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
    const data2 = await check2.json();
    console.log(`📊 After second comment: ${data2.chatHistory?.length || 0} messages in history`);
    
    // Test 3: Add third comment to further verify
    console.log('\n📝 Test 3: Third user adds comment...');
    const comment3 = `Final confirmation for ${employeeName}: Ready for client deployment tasks.`;
    const user3 = "Project Manager";
    
    const response3 = await fetch('http://localhost:5000/api/live-chat-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zohoId: zohoId,
        comments: comment3,
        commentsEnteredBy: user3
      })
    });
    
    const result3 = await response3.json();
    console.log('✅ Third comment result:', result3.success);
    
    // Final verification
    const finalCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
    const finalData = await finalCheck.json();
    
    console.log('\n🎯 FINAL VERIFICATION:');
    console.log('- Success:', finalData.success);
    console.log('- ZohoID:', finalData.zohoId);
    console.log('- Full Name:', finalData.fullName);
    console.log('- Total Messages:', finalData.chatHistory?.length || 0);
    console.log('- Latest Comment:', finalData.comments);
    console.log('- Comment By:', finalData.commentsEnteredBy);
    
    const expectedCount = initialCount + 3;
    const actualCount = finalData.chatHistory?.length || 0;
    
    if (actualCount === expectedCount) {
      console.log(`\n✅ SUCCESS: All ${expectedCount} comments preserved in chat history!`);
      console.log('📋 Complete conversation history:');
      finalData.chatHistory.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${new Date(msg.timestamp).toLocaleString()}] ${msg.sentBy}:`);
        console.log(`      "${msg.message.substring(0, 80)}..."`);
      });
      
      // Verify the new messages are present
      const hasFirstMessage = finalData.chatHistory.some(msg => msg.message.includes('Performance review'));
      const hasSecondMessage = finalData.chatHistory.some(msg => msg.message.includes('Updated assignment'));
      const hasThirdMessage = finalData.chatHistory.some(msg => msg.message.includes('Final confirmation'));
      
      if (hasFirstMessage && hasSecondMessage && hasThirdMessage) {
        console.log(`\n🎉 PERFECT: All new messages preserved with correct content for ${employeeName}!`);
        console.log('🔧 The ULTIMATE chat history fix is working correctly.');
      } else {
        console.log('\n❌ CONTENT ERROR: Some message content was corrupted');
      }
    } else {
      console.log(`\n❌ FAILURE: Expected ${expectedCount} messages, found ${actualCount}`);
      console.log('💡 This indicates the concurrent update issue still exists');
      
      if (finalData.chatHistory) {
        console.log('📋 Current messages:');
        finalData.chatHistory.forEach((msg, index) => {
          console.log(`   ${index + 1}. [${new Date(msg.timestamp).toLocaleString()}] ${msg.sentBy}:`);
          console.log(`      "${msg.message.substring(0, 80)}..."`);
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ TEST FAILED for ${employeeName} with error:`, error);
  }
}

// Run the test
testConcurrentChatFix();