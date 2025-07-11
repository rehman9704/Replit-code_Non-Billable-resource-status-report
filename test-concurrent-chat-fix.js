/**
 * TEST: Concurrent Chat History Fix
 * Simulates the exact issue with Prabhjas Singh Bajwa and concurrent comment additions
 */

async function testConcurrentChatFix() {
  console.log('🧪 TESTING: Concurrent Chat History Fix');
  console.log('==========================================');
  
  const zohoId = '10013034'; // Prabhjas Singh Bajwa
  const employeeName = 'Prabhjas Singh Bajwa';
  
  try {
    // Test 1: Add first comment
    console.log('\n📝 Test 1: First user adds comment...');
    const comment1 = "Employee is currently on bench. Looking for suitable project allocation.";
    const user1 = "Muhammad Rehman Shahid";
    
    const response1 = await fetch('/api/live-chat-comment', {
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
    const check1 = await fetch(`/api/live-chat-comments/${zohoId}`);
    const data1 = await check1.json();
    console.log(`📊 After first comment: ${data1.chatHistory?.length || 0} messages in history`);
    
    // Test 2: Add second comment (simulating concurrent user)
    console.log('\n📝 Test 2: Second user adds comment...');
    const comment2 = "Performance review scheduled for next week. Need to discuss project preferences.";
    const user2 = "Timesheet Admin";
    
    const response2 = await fetch('/api/live-chat-comment', {
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
    const check2 = await fetch(`/api/live-chat-comments/${zohoId}`);
    const data2 = await check2.json();
    console.log(`📊 After second comment: ${data2.chatHistory?.length || 0} messages in history`);
    
    // Test 3: Add third comment to further verify
    console.log('\n📝 Test 3: Third user adds comment...');
    const comment3 = "Updated status: Assigned to Digital Commerce project starting next Monday.";
    const user3 = "Project Manager";
    
    const response3 = await fetch('/api/live-chat-comment', {
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
    const finalCheck = await fetch(`/api/live-chat-comments/${zohoId}`);
    const finalData = await finalCheck.json();
    
    console.log('\n🎯 FINAL VERIFICATION:');
    console.log('- Success:', finalData.success);
    console.log('- ZohoID:', finalData.zohoId);
    console.log('- Full Name:', finalData.fullName);
    console.log('- Total Messages:', finalData.chatHistory?.length || 0);
    console.log('- Latest Comment:', finalData.comments);
    console.log('- Comment By:', finalData.commentsEnteredBy);
    
    if (finalData.chatHistory && finalData.chatHistory.length === 3) {
      console.log('\n✅ SUCCESS: All 3 comments preserved in chat history!');
      console.log('📋 Complete conversation history:');
      finalData.chatHistory.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${new Date(msg.timestamp).toLocaleString()}] ${msg.sentBy}:`);
        console.log(`      "${msg.message}"`);
      });
      
      // Verify specific content
      const hasFirstMessage = finalData.chatHistory.some(msg => msg.message.includes('bench'));
      const hasSecondMessage = finalData.chatHistory.some(msg => msg.message.includes('Performance review'));
      const hasThirdMessage = finalData.chatHistory.some(msg => msg.message.includes('Digital Commerce'));
      
      if (hasFirstMessage && hasSecondMessage && hasThirdMessage) {
        console.log('\n🎉 PERFECT: All messages preserved with correct content!');
        console.log('🔧 The concurrent chat history fix is working correctly.');
      } else {
        console.log('\n❌ CONTENT ERROR: Some message content was corrupted');
      }
    } else {
      console.log(`\n❌ FAILURE: Expected 3 messages, found ${finalData.chatHistory?.length || 0}`);
      console.log('💡 This indicates the concurrent update issue still exists');
    }
    
    console.log('\n==========================================');
    console.log('🧪 CONCURRENT CHAT HISTORY TEST COMPLETED');
    
  } catch (error) {
    console.error('❌ TEST FAILED with error:', error);
  }
}

// Run the test
testConcurrentChatFix();