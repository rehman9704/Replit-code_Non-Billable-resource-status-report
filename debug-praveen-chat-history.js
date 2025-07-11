/**
 * DEBUG: Praveen M G Chat History Real-Time Check
 * Quick diagnostic to verify the current state of Praveen M G's chat history
 */

async function debugPraveenChatHistory() {
  console.log('🔍 DEBUGGING: Praveen M G Chat History Status');
  console.log('============================================');
  
  const zohoId = '10012260';
  
  try {
    // Check current API endpoint
    const response = await fetch('/api/live-chat-comments/10012260');
    const data = await response.json();
    
    console.log('📋 Current API Response:');
    console.log('- Success:', data.success);
    console.log('- ZohoID:', data.zohoId);
    console.log('- Full Name:', data.fullName);
    console.log('- Has Comments:', data.hasComments);
    console.log('- Current Comment:', data.comments);
    console.log('- Comment By:', data.commentsEnteredBy);
    console.log('- Last Updated:', data.commentsUpdateDateTime);
    console.log('- Chat History Length:', data.chatHistory?.length || 0);
    
    if (data.chatHistory && data.chatHistory.length > 0) {
      console.log('\n📝 Complete Chat History:');
      data.chatHistory.forEach((msg, index) => {
        console.log(`${index + 1}. [${new Date(msg.timestamp).toLocaleString()}] ${msg.sentBy}:`);
        console.log(`   "${msg.message}"`);
      });
    } else {
      console.log('\n❌ No chat history found');
    }
    
    // Test adding a new comment
    console.log('\n🧪 Testing new comment addition...');
    const testComment = `Debug test comment added at ${new Date().toLocaleString()}`;
    
    const addResponse = await fetch('/api/live-chat-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zohoId: '10012260',
        comments: testComment,
        commentsEnteredBy: 'Debug Test User'
      })
    });
    
    const addResult = await addResponse.json();
    console.log('✅ Add comment result:', addResult.success);
    
    if (addResult.success) {
      // Check updated state
      const updatedResponse = await fetch('/api/live-chat-comments/10012260');
      const updatedData = await updatedResponse.json();
      
      console.log('\n📊 Updated State:');
      console.log('- Chat History Length:', updatedData.chatHistory?.length || 0);
      console.log('- Latest Comment:', updatedData.comments);
      console.log('- Comment By:', updatedData.commentsEnteredBy);
      
      if (updatedData.chatHistory && updatedData.chatHistory.length > 0) {
        console.log('\n📝 Updated Chat History:');
        updatedData.chatHistory.forEach((msg, index) => {
          console.log(`${index + 1}. [${new Date(msg.timestamp).toLocaleString()}] ${msg.sentBy}:`);
          console.log(`   "${msg.message}"`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugPraveenChatHistory();