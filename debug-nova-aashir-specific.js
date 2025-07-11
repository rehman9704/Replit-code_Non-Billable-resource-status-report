/**
 * DEBUG: Nova J and Muhammad Aashir Specific Issue
 * Reproduces the exact 17-hour comment replacement issue
 */

async function debugNovaAashirIssue() {
  console.log('🔍 DEBUG: Nova J and Muhammad Aashir Comment Replacement');
  console.log('=====================================================');
  
  const employees = [
    { zohoId: '10012021', name: 'Nova J' },
    { zohoId: '10114434', name: 'Muhammad Aashir' }
  ];
  
  for (const employee of employees) {
    console.log(`\n📝 INVESTIGATING: ${employee.name} (${employee.zohoId})`);
    console.log('-'.repeat(60));
    
    try {
      // Get current state
      const currentResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${employee.zohoId}`);
      const currentData = await currentResponse.json();
      
      if (currentData.success && currentData.chatHistory) {
        console.log(`Current message count: ${currentData.chatHistory.length}`);
        
        console.log('\n📋 Current chat history:');
        currentData.chatHistory.forEach((msg, index) => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
          console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
        });
        
        // Check if there are any messages older than 10 hours
        const veryOldMessages = currentData.chatHistory.filter(msg => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = (new Date() - timestamp) / (1000 * 60 * 60);
          return hoursAgo > 10;
        });
        
        if (veryOldMessages.length === 0) {
          console.log('\n❌ ISSUE CONFIRMED: No messages older than 10 hours found');
          console.log('💡 This confirms that 17-hour-old comments were replaced');
          
          // Simulate adding a comment from the original account that added 17h ago comment
          console.log('\n🧪 TESTING: Adding comment from "Muhammad Rehman Shahid" (likely original account)...');
          
          const testComment = `TEST 17H SIMULATION: Comment from original account - ${new Date().toLocaleString()}`;
          
          const addResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              zohoId: employee.zohoId,
              comments: testComment,
              commentsEnteredBy: "Muhammad Rehman Shahid"
            })
          });
          
          const addResult = await addResponse.json();
          console.log(`✅ Original account comment result: ${addResult.success}`);
          
          // Wait and add from different account (Time Sheet Admin)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log('\n🧪 TESTING: Adding comment from "Time Sheet Admin" (different account)...');
          
          const differentComment = `TEST REPLACEMENT: Comment from different account - ${new Date().toLocaleString()}`;
          
          const differentResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              zohoId: employee.zohoId,
              comments: differentComment,
              commentsEnteredBy: "Time Sheet Admin"
            })
          });
          
          const differentResult = await differentResponse.json();
          console.log(`✅ Different account comment result: ${differentResult.success}`);
          
          // Check final state
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const finalResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${employee.zohoId}`);
          const finalData = await finalResponse.json();
          
          console.log('\n🔍 FINAL VERIFICATION:');
          console.log(`- Messages before test: ${currentData.chatHistory.length}`);
          console.log(`- Messages after test: ${finalData.chatHistory?.length || 0}`);
          console.log(`- Expected: ${currentData.chatHistory.length + 2}`);
          
          if (finalData.chatHistory) {
            const hasOriginalTest = finalData.chatHistory.some(msg => 
              msg.message.includes('TEST 17H SIMULATION') && msg.sentBy === 'Muhammad Rehman Shahid'
            );
            const hasDifferentTest = finalData.chatHistory.some(msg => 
              msg.message.includes('TEST REPLACEMENT') && msg.sentBy === 'Time Sheet Admin'
            );
            
            console.log(`- Original test comment preserved: ${hasOriginalTest ? '✅' : '❌'}`);
            console.log(`- Different test comment added: ${hasDifferentTest ? '✅' : '❌'}`);
            
            if (hasOriginalTest && hasDifferentTest) {
              console.log('✅ SUCCESS: Atomic fix is working for this employee now');
            } else {
              console.log('❌ FAILURE: Comment replacement still occurring');
            }
            
            console.log('\n📋 Final chat history:');
            finalData.chatHistory.forEach((msg, index) => {
              const timestamp = new Date(msg.timestamp);
              const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
              console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
            });
          }
          
        } else {
          console.log(`\n✅ Found ${veryOldMessages.length} very old messages (>10h)`);
          veryOldMessages.forEach((msg, index) => {
            const timestamp = new Date(msg.timestamp);
            const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
            console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 50)}...`);
          });
        }
        
      } else {
        console.log('⚠️ No existing comments found for this employee');
      }
      
    } catch (error) {
      console.error(`❌ Investigation failed for ${employee.name}:`, error);
    }
  }
  
  console.log('\n=====================================================');
  console.log('🔍 NOVA J & MUHAMMAD AASHIR INVESTIGATION COMPLETED');
}

// Run the investigation
debugNovaAashirIssue();