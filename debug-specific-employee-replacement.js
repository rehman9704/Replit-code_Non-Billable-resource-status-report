/**
 * DEBUG: Specific Employee Comment Replacement
 * Investigates the exact scenario reported by user
 */

async function debugSpecificEmployeeReplacement() {
  console.log('🔍 DEBUG: Specific Employee Comment Replacement');
  console.log('==============================================');
  
  // Get all employees with comments from the last 24 hours
  console.log('📊 Fetching all employees with recent comment activity...');
  
  try {
    const response = await fetch('http://localhost:5000/api/live-chat-comments');
    const allEmployees = await response.json();
    
    if (allEmployees.success && allEmployees.data) {
      console.log(`Found ${allEmployees.data.length} employees with comments`);
      
      // Filter employees with potentially old comments
      const employeesWithOldComments = [];
      
      for (const employee of allEmployees.data) {
        if (employee.chatHistory) {
          try {
            const history = JSON.parse(employee.chatHistory);
            
            // Check for messages older than 12 hours
            const oldMessages = history.filter(msg => {
              const timestamp = new Date(msg.timestamp);
              const hoursAgo = (new Date() - timestamp) / (1000 * 60 * 60);
              return hoursAgo > 12;
            });
            
            if (oldMessages.length > 0) {
              const mostRecentComment = new Date(employee.commentsUpdateDateTime);
              const hoursSinceUpdate = (new Date() - mostRecentComment) / (1000 * 60 * 60);
              
              employeesWithOldComments.push({
                zohoId: employee.zohoId,
                fullName: employee.fullName,
                totalMessages: history.length,
                oldMessages: oldMessages.length,
                hoursSinceUpdate: Math.floor(hoursSinceUpdate),
                latestCommentBy: employee.commentsEnteredBy,
                oldestMessage: oldMessages[0]
              });
            }
          } catch (e) {
            console.log(`⚠️ Could not parse history for ${employee.fullName}`);
          }
        }
      }
      
      console.log(`\n📋 Employees with old comments (>12h): ${employeesWithOldComments.length}`);
      
      // Show detailed breakdown
      employeesWithOldComments.forEach((emp, index) => {
        console.log(`\n${index + 1}. ${emp.fullName} (${emp.zohoId})`);
        console.log(`   - Total messages: ${emp.totalMessages}`);
        console.log(`   - Old messages: ${emp.oldMessages}`);
        console.log(`   - Hours since last update: ${emp.hoursSinceUpdate}`);
        console.log(`   - Latest comment by: ${emp.latestCommentBy}`);
        console.log(`   - Oldest message: [${emp.oldestMessage.sentBy}] ${emp.oldestMessage.message.substring(0, 50)}...`);
      });
      
      // Test scenario: Add new comment to employee with oldest comments
      if (employeesWithOldComments.length > 0) {
        const testEmployee = employeesWithOldComments[0];
        console.log(`\n🧪 TESTING REPLACEMENT SCENARIO with ${testEmployee.fullName}`);
        
        // Get detailed current state
        const currentCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${testEmployee.zohoId}`);
        const currentData = await currentCheck.json();
        
        console.log('\n📋 BEFORE - Complete message history:');
        currentData.chatHistory.forEach((msg, index) => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
          console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 70)}...`);
        });
        
        // Add new comment from different account
        const newComment = `DEBUG TEST: Checking if old comments survive - ${new Date().toLocaleTimeString()}`;
        const newUser = "Debug Test Account";
        
        console.log(`\n📝 Adding new comment from "${newUser}"...`);
        
        const addResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zohoId: testEmployee.zohoId,
            comments: newComment,
            commentsEnteredBy: newUser
          })
        });
        
        const addResult = await addResponse.json();
        console.log(`✅ Add result: ${addResult.success}`);
        
        // Check final state
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const finalCheck = await fetch(`http://localhost:5000/api/live-chat-comments/${testEmployee.zohoId}`);
        const finalData = await finalCheck.json();
        
        console.log('\n📋 AFTER - Complete message history:');
        finalData.chatHistory.forEach((msg, index) => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
          console.log(`   ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 70)}...`);
        });
        
        // Analysis
        console.log('\n🔍 ANALYSIS:');
        console.log(`- Messages before: ${currentData.chatHistory.length}`);
        console.log(`- Messages after: ${finalData.chatHistory.length}`);
        console.log(`- Expected: ${currentData.chatHistory.length + 1}`);
        
        // Check if old messages survived
        let survivedOldMessages = 0;
        const oldMessages = currentData.chatHistory.filter(msg => {
          const timestamp = new Date(msg.timestamp);
          const hoursAgo = (new Date() - timestamp) / (1000 * 60 * 60);
          return hoursAgo > 12;
        });
        
        for (const oldMsg of oldMessages) {
          const stillExists = finalData.chatHistory.some(msg => 
            msg.message === oldMsg.message && 
            msg.sentBy === oldMsg.sentBy &&
            msg.timestamp === oldMsg.timestamp
          );
          
          if (stillExists) {
            survivedOldMessages++;
          } else {
            console.log(`❌ LOST OLD MESSAGE: [${oldMsg.sentBy}] ${oldMsg.message.substring(0, 50)}...`);
          }
        }
        
        console.log(`- Old messages preserved: ${survivedOldMessages}/${oldMessages.length}`);
        
        if (survivedOldMessages === oldMessages.length && finalData.chatHistory.length === currentData.chatHistory.length + 1) {
          console.log('✅ SUCCESS: All old messages preserved, new message added');
        } else {
          console.log('❌ FAILURE: Comment replacement issue detected');
        }
        
      } else {
        console.log('\n⚠️ No employees found with old comments to test');
      }
      
    } else {
      console.log('❌ Could not fetch employee data');
    }
    
  } catch (error) {
    console.error('❌ DEBUG TEST FAILED:', error);
  }
  
  console.log('\n==============================================');
  console.log('🔍 DEBUG TEST COMPLETED');
}

// Run the debug test
debugSpecificEmployeeReplacement();