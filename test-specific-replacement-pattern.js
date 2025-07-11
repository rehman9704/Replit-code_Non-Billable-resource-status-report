/**
 * TEST: Specific Comment Replacement Pattern
 * Tests the exact scenario: 17-hour-old comment replaced when different account adds new comment
 */

async function testSpecificReplacementPattern() {
  console.log('🧪 TESTING: Specific Comment Replacement Pattern');
  console.log('================================================');
  
  // Target employees with known old comments based on database query
  const targetEmployees = [
    { zohoId: '10013595', name: 'Aakash Gupta', oldestSender: 'Muhammad Rehman Shahid' },
    { zohoId: '10012643', name: 'Abbas Elahi ASAD ULLAH', oldestSender: 'Muhammad Rehman Shahid' },
    { zohoId: '10114016', name: 'Ahmad Alattar', oldestSender: 'Muhammad Rehman Shahid' }
  ];
  
  for (const employee of targetEmployees) {
    console.log(`\n📝 TESTING: ${employee.name} (${employee.zohoId})`);
    console.log('-'.repeat(60));
    
    try {
      // Test the exact replacement scenario
      console.log('🔄 Simulating comment replacement scenario...');
      
      // Step 1: Add comment from original account (simulating old comment)
      const originalComment = `ORIGINAL: Historical comment from ${employee.oldestSender} - ${new Date().toLocaleString()}`;
      
      console.log(`1. Adding comment from "${employee.oldestSender}"...`);
      const originalResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zohoId: employee.zohoId,
          comments: originalComment,
          commentsEnteredBy: employee.oldestSender
        })
      });
      
      const originalResult = await originalResponse.json();
      console.log(`   Result: ${originalResult.success}`);
      
      // Brief wait to establish timestamp difference
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 2: Add comment from different account (this should trigger replacement if bug exists)
      const differentAccount = "Time Sheet Admin";
      const newComment = `NEW: Comment from different account - ${new Date().toLocaleString()}`;
      
      console.log(`2. Adding comment from "${differentAccount}"...`);
      const newResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zohoId: employee.zohoId,
          comments: newComment,
          commentsEnteredBy: differentAccount
        })
      });
      
      const newResult = await newResponse.json();
      console.log(`   Result: ${newResult.success}`);
      
      // Step 3: Verify both comments exist
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const verifyResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${employee.zohoId}`);
      const verifyData = await verifyResponse.json();
      
      console.log('\n🔍 VERIFICATION RESULTS:');
      if (verifyData.success && verifyData.chatHistory) {
        console.log(`   Total messages: ${verifyData.chatHistory.length}`);
        
        // Check if both messages exist
        const hasOriginal = verifyData.chatHistory.some(msg => 
          msg.message.includes('ORIGINAL') && msg.sentBy === employee.oldestSender
        );
        const hasNew = verifyData.chatHistory.some(msg => 
          msg.message.includes('NEW') && msg.sentBy === differentAccount
        );
        
        console.log(`   Original message preserved: ${hasOriginal ? '✅' : '❌'}`);
        console.log(`   New message added: ${hasNew ? '✅' : '❌'}`);
        
        if (hasOriginal && hasNew) {
          console.log('✅ SUCCESS: Both messages preserved - no replacement occurred');
        } else {
          console.log('❌ FAILURE: Comment replacement detected');
          
          // Show what actually exists
          console.log('\n📋 Actual message history:');
          verifyData.chatHistory.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.sentBy}] ${msg.message.substring(0, 50)}...`);
          });
        }
        
        // Test rapid succession scenario
        console.log('\n🔄 Testing rapid succession scenario...');
        
        // Add multiple comments in rapid succession from different accounts
        const rapidComments = [
          { user: 'Account A', comment: 'Rapid test 1' },
          { user: 'Account B', comment: 'Rapid test 2' },
          { user: 'Account C', comment: 'Rapid test 3' }
        ];
        
        const rapidPromises = rapidComments.map(({ user, comment }) => 
          fetch('http://localhost:5000/api/live-chat-comment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              zohoId: employee.zohoId,
              comments: `${comment} - ${new Date().toLocaleTimeString()}`,
              commentsEnteredBy: user
            })
          })
        );
        
        const rapidResults = await Promise.all(rapidPromises);
        console.log(`   Rapid comments added: ${rapidResults.filter(r => r.ok).length}/${rapidResults.length}`);
        
        // Final verification
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const finalResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${employee.zohoId}`);
        const finalData = await finalResponse.json();
        
        console.log('\n🎯 FINAL VERIFICATION:');
        console.log(`   Total messages: ${finalData.chatHistory?.length || 0}`);
        console.log(`   Expected minimum: ${verifyData.chatHistory.length + 3}`);
        
        if (finalData.chatHistory?.length >= verifyData.chatHistory.length + 3) {
          console.log('✅ SUCCESS: All rapid comments preserved');
        } else {
          console.log('❌ FAILURE: Some rapid comments lost');
        }
        
      } else {
        console.log('❌ ERROR: Could not verify message history');
      }
      
    } catch (error) {
      console.error(`❌ TEST FAILED for ${employee.name}:`, error);
    }
  }
  
  console.log('\n================================================');
  console.log('🧪 SPECIFIC REPLACEMENT PATTERN TEST COMPLETED');
  console.log('💡 If all tests show SUCCESS, the atomic fix is working correctly');
  console.log('💡 If you still see the issue, please provide specific employee ZohoID and account details');
}

// Run the test
testSpecificReplacementPattern();