/**
 * TEST: Old Comment Replacement Issue
 * Reproduces the exact issue where 17-hour-old comments get replaced
 * when new comments are added from different accounts
 */

async function testOldCommentReplacement() {
  console.log('🧪 TESTING: Old Comment Replacement Issue');
  console.log('=========================================');
  
  // Test with an employee who has existing historical comments
  const testEmployees = [
    { zohoId: '10010368', name: 'Anjali Garg' },
    { zohoId: '10013124', name: 'Abdallah Nadeem' },
    { zohoId: '10114016', name: 'Ahmad Alattar' }
  ];
  
  for (const employee of testEmployees) {
    console.log(`\n📝 TESTING: ${employee.name} (${employee.zohoId})`);
    console.log('-'.repeat(50));
    
    try {
      // Get current state
      console.log('📊 Checking current state...');
      const currentCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${employee.zohoId}`);
      const currentData = await currentCheck.json();
      
      if (currentData.success && currentData.chatHistory) {
        console.log(`   Current messages: ${currentData.chatHistory.length}`);
        
        // Show all existing messages with timestamps
        console.log('📋 Current chat history:');
        currentData.chatHistory.forEach((msg, index) => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
          console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
        });
        
        // Check if there are any old messages (more than 1 hour old)
        const oldMessages = currentData.chatHistory.filter(msg => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = (new Date() - timestamp) / (1000 * 60 * 60);
          return hoursAgo > 1;
        });
        
        console.log(`   Old messages (>1h): ${oldMessages.length}`);
        
        if (oldMessages.length > 0) {
          console.log('\n📝 Adding new comment from different account...');
          
          // Add new comment from different account
          const newComment = `TEST REPLACEMENT: New comment from different account at ${new Date().toLocaleTimeString()}`;
          const newUser = "Different Account Test";
          
          const response = await fetch('http://localhost:5000/api/live-chat-comment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              zohoId: employee.zohoId,
              comments: newComment,
              commentsEnteredBy: newUser
            })
          });
          
          const result = await response.json();
          console.log('✅ New comment result:', result.success);
          
          // Check if old comments were preserved
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief wait
          
          const afterCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${employee.zohoId}`);
          const afterData = await afterCheck.json();
          
          console.log('\n🔍 VERIFICATION RESULTS:');
          console.log(`- Messages before: ${currentData.chatHistory.length}`);
          console.log(`- Messages after: ${afterData.chatHistory?.length || 0}`);
          console.log(`- Old messages before: ${oldMessages.length}`);
          
          if (afterData.success && afterData.chatHistory) {
            // Check if old messages still exist
            let preservedOldMessages = 0;
            
            for (const oldMsg of oldMessages) {
              const stillExists = afterData.chatHistory.some(msg => 
                msg.message === oldMsg.message && 
                msg.sentBy === oldMsg.sentBy &&
                msg.timestamp === oldMsg.timestamp
              );
              
              if (stillExists) {
                preservedOldMessages++;
              } else {
                console.log(`❌ LOST MESSAGE: [${oldMsg.sentBy}] ${oldMsg.message.substring(0, 50)}...`);
              }
            }
            
            console.log(`- Old messages preserved: ${preservedOldMessages}/${oldMessages.length}`);
            
            if (preservedOldMessages === oldMessages.length) {
              console.log('✅ SUCCESS: All old messages preserved!');
            } else {
              console.log('❌ FAILURE: Some old messages were lost!');
              console.log('💡 This confirms the replacement issue exists');
            }
            
            // Show final state
            console.log('\n📋 Final chat history:');
            afterData.chatHistory.forEach((msg, index) => {
              const timestamp = new Date(msg.timestamp);
              const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
              console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
            });
            
          } else {
            console.log('❌ ERROR: Could not verify final state');
          }
        } else {
          console.log('⚠️ No old messages found for this employee');
        }
        
      } else {
        console.log('⚠️ No existing comments found for this employee');
      }
      
    } catch (error) {
      console.error(`❌ TEST FAILED for ${employee.name}:`, error);
    }
  }
  
  console.log('\n=========================================');
  console.log('🧪 OLD COMMENT REPLACEMENT TEST COMPLETED');
}

// Run the test
testOldCommentReplacement();