/**
 * TEST: ATOMIC Chat History Fix
 * Tests the new atomic implementation with real concurrent scenarios
 */

async function testAtomicChatFix() {
  console.log('🧪 TESTING: ATOMIC Chat History Fix');
  console.log('==========================================');
  
  // Test with problematic employee from user report
  const testEmployee = {
    zohoId: '10000391',
    name: 'Prashanth Janardhanan'
  };
  
  console.log(`\n📝 TESTING: ${testEmployee.name} (${testEmployee.zohoId})`);
  
  try {
    // Check current state
    console.log('📊 Checking current state...');
    const initialCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${testEmployee.zohoId}`);
    const initialData = await initialCheck.json();
    const initialCount = initialData.chatHistory?.length || 0;
    console.log(`   Current messages: ${initialCount}`);
    
    // Test atomic comment addition
    console.log('\n📝 Test: Adding atomic comment...');
    const atomicComment = `ATOMIC TEST: ${testEmployee.name} - Testing atomic chat preservation at ${new Date().toLocaleTimeString()}`;
    const user = "Atomic Test User";
    
    const response = await fetch('http://localhost:5000/api/live-chat-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zohoId: testEmployee.zohoId,
        comments: atomicComment,
        commentsEnteredBy: user
      })
    });
    
    const result = await response.json();
    console.log('✅ Atomic comment result:', result.success);
    
    // Immediate verification
    const verifyCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${testEmployee.zohoId}`);
    const verifyData = await verifyCheck.json();
    
    console.log('\n🎯 VERIFICATION RESULTS:');
    console.log('- Success:', verifyData.success);
    console.log('- Employee:', verifyData.fullName);
    console.log('- Total Messages:', verifyData.chatHistory?.length || 0);
    console.log('- Expected Count:', initialCount + 1);
    
    const expectedCount = initialCount + 1;
    const actualCount = verifyData.chatHistory?.length || 0;
    
    if (actualCount === expectedCount) {
      console.log(`\n✅ SUCCESS: Message count increased from ${initialCount} to ${actualCount}`);
      
      // Check if the new message is present
      const hasNewMessage = verifyData.chatHistory.some(msg => 
        msg.message.includes('ATOMIC TEST') && msg.sentBy === user
      );
      
      if (hasNewMessage) {
        console.log('✅ SUCCESS: New atomic message found in history');
        console.log('\n📋 Complete message history:');
        verifyData.chatHistory.forEach((msg, index) => {
          console.log(`   ${index + 1}. [${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.sentBy}:`);
          console.log(`      "${msg.message.substring(0, 70)}..."`);
        });
        
        console.log('\n🎉 ATOMIC CHAT FIX IS WORKING CORRECTLY!');
      } else {
        console.log('❌ ERROR: New message not found in history despite correct count');
      }
    } else {
      console.log(`\n❌ FAILURE: Expected ${expectedCount} messages, found ${actualCount}`);
      console.log('💡 Atomic fix may still have issues');
    }
    
    // Test concurrent scenario simulation
    console.log('\n🔄 Testing concurrent comment scenario...');
    
    const promises = [];
    for (let i = 1; i <= 3; i++) {
      const concurrentComment = `Concurrent test ${i} for ${testEmployee.name} at ${new Date().toLocaleTimeString()}`;
      const concurrentUser = `User ${i}`;
      
      promises.push(
        fetch('http://localhost:5000/api/live-chat-comment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zohoId: testEmployee.zohoId,
            comments: concurrentComment,
            commentsEnteredBy: concurrentUser
          })
        })
      );
    }
    
    // Execute all requests simultaneously
    const concurrentResults = await Promise.all(promises);
    console.log('✅ All concurrent requests completed');
    
    // Final verification after concurrent test
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief wait
    
    const finalCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${testEmployee.zohoId}`);
    const finalData = await finalCheck.json();
    const finalCount = finalData.chatHistory?.length || 0;
    
    console.log('\n🎯 FINAL CONCURRENT TEST RESULTS:');
    console.log(`- Messages before concurrent test: ${actualCount}`);
    console.log(`- Messages after concurrent test: ${finalCount}`);
    console.log(`- Expected increase: +3`);
    console.log(`- Actual increase: +${finalCount - actualCount}`);
    
    if (finalCount === actualCount + 3) {
      console.log('\n🎉 PERFECT: All concurrent messages preserved!');
      console.log('🔧 The ATOMIC chat history fix handles concurrent access correctly.');
    } else {
      console.log('\n⚠️ CONCERN: Some concurrent messages may have been lost');
      console.log('💡 Concurrent handling needs improvement');
    }
    
    console.log('\n==========================================');
    console.log('🧪 ATOMIC CHAT HISTORY TEST COMPLETED');
    
  } catch (error) {
    console.error('❌ TEST FAILED with error:', error);
  }
}

// Run the test
testAtomicChatFix();