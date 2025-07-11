/**
 * TEST: Mohammad Abdul Wahab Khan Specific Fix
 * Tests the enhanced bulletproof system for accurate chat history handling
 */

async function testMohammadAbdulWahabFix() {
  console.log('🔍 TESTING: Mohammad Abdul Wahab Khan (10114331) Chat Fix');
  console.log('======================================================');
  
  const zohoId = '10114331';
  const employeeName = 'Mohammad Abdul Wahab Khan';
  
  try {
    // STEP 1: Get current state
    console.log('\n📊 STEP 1: Current State Check');
    console.log('-'.repeat(30));
    
    const currentResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
    const currentData = await currentResponse.json();
    
    if (currentData.success && currentData.chatHistory) {
      console.log(`Current message count: ${currentData.chatHistory.length}`);
      
      console.log('\n📋 Current chat history:');
      currentData.chatHistory.forEach((msg, index) => {
        const timestamp = new Date(msg.timestamp);
        const minutesAgo = Math.floor((new Date() - timestamp) / (1000 * 60));
        console.log(`   ${index + 1}. [${minutesAgo}m ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
      });
    } else {
      console.log('No existing chat history found');
    }
    
    const initialCount = currentData.chatHistory?.length || 0;
    
    // STEP 2: Add a test comment to verify preservation
    console.log('\n🧪 STEP 2: Adding Test Comment');
    console.log('-'.repeat(30));
    
    const testComment = `PRESERVATION TEST: Adding comment to verify previous messages are preserved - ${new Date().toLocaleTimeString()}`;
    
    const addResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zohoId: zohoId,
        comments: testComment,
        commentsEnteredBy: "Test Account"
      })
    });
    
    const addResult = await addResponse.json();
    console.log(`✅ Comment addition result: ${addResult.success}`);
    
    // STEP 3: Verify preservation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🔍 STEP 3: Verification');
    console.log('-'.repeat(30));
    
    const verifyResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
    const verifyData = await verifyResponse.json();
    
    if (verifyData.success && verifyData.chatHistory) {
      const finalCount = verifyData.chatHistory.length;
      const expectedCount = initialCount + 1;
      
      console.log(`📊 Messages before test: ${initialCount}`);
      console.log(`📊 Messages after test: ${finalCount}`);
      console.log(`📊 Expected count: ${expectedCount}`);
      
      if (finalCount === expectedCount) {
        console.log('✅ SUCCESS: Correct message count - no data loss');
      } else if (finalCount < expectedCount) {
        console.log('❌ FAILURE: Messages lost during addition');
      } else {
        console.log('⚠️ WARNING: More messages than expected (duplicates?)');
      }
      
      // Check if specific test message exists
      const hasTestMessage = verifyData.chatHistory.some(msg => 
        msg.message.includes('PRESERVATION TEST') && msg.sentBy === 'Test Account'
      );
      
      console.log(`✅ Test message preserved: ${hasTestMessage}`);
      
      // Show final history
      console.log('\n📋 Final chat history:');
      verifyData.chatHistory.forEach((msg, index) => {
        const timestamp = new Date(msg.timestamp);
        const minutesAgo = Math.floor((new Date() - timestamp) / (1000 * 60));
        console.log(`   ${index + 1}. [${minutesAgo}m ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
      });
      
      // STEP 4: Add another comment from different account
      console.log('\n🧪 STEP 4: Adding Second Comment (Different Account)');
      console.log('-'.repeat(50));
      
      const secondComment = `SECOND TEST: Different account comment - ${new Date().toLocaleTimeString()}`;
      
      const secondResponse = await fetch('http://localhost:5000/api/live-chat-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zohoId: zohoId,
          comments: secondComment,
          commentsEnteredBy: "Different Test Account"
        })
      });
      
      const secondResult = await secondResponse.json();
      console.log(`✅ Second comment result: ${secondResult.success}`);
      
      // Final verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalResponse = await fetch(`http://localhost:5000/api/live-chat-comments/${zohoId}`);
      const finalData = await finalResponse.json();
      
      if (finalData.success && finalData.chatHistory) {
        const absoluteFinalCount = finalData.chatHistory.length;
        const absoluteExpectedCount = initialCount + 2;
        
        console.log('\n🔍 FINAL VERIFICATION:');
        console.log(`📊 Initial count: ${initialCount}`);
        console.log(`📊 Final count: ${absoluteFinalCount}`);
        console.log(`📊 Expected: ${absoluteExpectedCount}`);
        
        if (absoluteFinalCount === absoluteExpectedCount) {
          console.log('✅ BULLETPROOF SUCCESS: All messages preserved perfectly');
        } else {
          console.log('❌ BULLETPROOF FAILURE: Message count incorrect');
        }
        
        // Show complete final history
        console.log('\n📋 Complete final history:');
        finalData.chatHistory.forEach((msg, index) => {
          const timestamp = new Date(msg.timestamp);
          const minutesAgo = Math.floor((new Date() - timestamp) / (1000 * 60));
          console.log(`   ${index + 1}. [${minutesAgo}m ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
        });
      }
      
    } else {
      console.log('❌ ERROR: Could not retrieve verification data');
    }
    
  } catch (error) {
    console.error(`❌ TEST FAILED for ${employeeName}:`, error);
  }
  
  console.log('\n======================================================');
  console.log('🔍 MOHAMMAD ABDUL WAHAB KHAN TEST COMPLETED');
  console.log('💡 This test verifies the bulletproof chat preservation system');
}

// Run the test
testMohammadAbdulWahabFix();