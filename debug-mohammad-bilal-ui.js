/**
 * Mohammad Bilal G UI Display Debug Script
 * Tests the complete flow from API to UI rendering
 */

console.log('🎯 DEBUGGING MOHAMMAD BILAL G UI DISPLAY...');

// First test API directly
async function testAPI() {
  console.log('🔌 Testing API endpoint...');
  try {
    const response = await fetch('/api/chat-messages/25');
    const comments = await response.json();
    console.log(`✅ API returned ${comments.length} comments for Mohammad Bilal G:`);
    
    comments.forEach((comment, index) => {
      console.log(`📝 Comment ${index + 1}:`, {
        id: comment.id,
        sender: comment.sender,
        content: comment.content.substring(0, 50) + '...',
        timestamp: comment.timestamp
      });
    });
    
    return comments;
  } catch (error) {
    console.error('❌ API test failed:', error);
    return [];
  }
}

// Test React Query cache
function testReactQueryCache() {
  console.log('🔍 Testing React Query cache...');
  
  if (window.queryClient) {
    const cacheData = window.queryClient.getQueryData(['chat-messages', '25']);
    console.log('📊 Cache data for employee 25:', cacheData);
    
    // Force invalidate
    window.queryClient.invalidateQueries({ queryKey: ['chat-messages', '25'] });
    console.log('🔄 Cache invalidated for employee 25');
    
    // Force refetch
    window.queryClient.refetchQueries({ queryKey: ['chat-messages', '25'] });
    console.log('🔃 Forced refetch for employee 25');
    
    return true;
  } else {
    console.log('❌ React Query client not found');
    return false;
  }
}

// Find Mohammad Bilal G in the table
function findMohammadBilalInTable() {
  console.log('🔍 Searching for Mohammad Bilal G in employee table...');
  
  const rows = document.querySelectorAll('table tbody tr');
  let foundRow = null;
  
  rows.forEach((row, index) => {
    const nameCell = row.querySelector('td:nth-child(2)');
    if (nameCell && nameCell.textContent.includes('Mohammad Bilal')) {
      foundRow = row;
      console.log(`✅ Found Mohammad Bilal G in row ${index + 1}`);
      console.log(`   Full name: "${nameCell.textContent}"`);
      
      // Check message count badge
      const badge = row.querySelector('[class*="badge"], [class*="count"]');
      if (badge) {
        console.log(`   Message count badge: "${badge.textContent}"`);
      }
      
      // Find chat button
      const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"]');
      if (chatButton) {
        console.log('   💬 Chat button found');
        return chatButton;
      } else {
        console.log('   ❌ Chat button not found');
      }
    }
  });
  
  if (!foundRow) {
    console.log('❌ Mohammad Bilal G not found in current table view');
  }
  
  return foundRow;
}

// Test opening chat dialog
function testChatDialog(row) {
  if (!row) {
    console.log('❌ Cannot test chat dialog - row not provided');
    return;
  }
  
  console.log('💬 Testing chat dialog...');
  
  const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"]');
  if (!chatButton) {
    console.log('❌ Chat button not found');
    return;
  }
  
  console.log('🖱️ Clicking chat button...');
  chatButton.click();
  
  setTimeout(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      console.log('✅ Chat dialog opened');
      
      // Check for messages in the dialog
      const messageElements = dialog.querySelectorAll('[class*="space-y-6"] > div, .message, [class*="rounded-lg"]');
      console.log(`📱 Found ${messageElements.length} message elements in dialog`);
      
      messageElements.forEach((element, index) => {
        const text = element.textContent;
        console.log(`   Message ${index + 1}: "${text.substring(0, 50)}..."`);
      });
      
      // Check for "No comments yet" message
      const noCommentsMsg = dialog.querySelector(':contains("No comments yet")');
      if (noCommentsMsg || dialog.textContent.includes('No comments yet')) {
        console.log('⚠️ "No comments yet" message found - this indicates UI rendering issue');
      }
      
      // Force close dialog
      setTimeout(() => {
        const closeButton = dialog.querySelector('button[aria-label="Close"], [data-dismiss="modal"]');
        if (closeButton) {
          closeButton.click();
          console.log('🔒 Dialog closed');
        }
      }, 3000);
      
    } else {
      console.log('❌ Chat dialog not found after clicking button');
    }
  }, 1000);
}

// Main test sequence
async function runCompleteTest() {
  console.log('🚀 Starting complete Mohammad Bilal G UI test...');
  
  // Step 1: Test API
  const apiComments = await testAPI();
  
  // Step 2: Test React Query cache
  const cacheWorking = testReactQueryCache();
  
  // Step 3: Find in table
  const tableRow = findMohammadBilalInTable();
  
  // Step 4: Test chat dialog
  if (tableRow) {
    testChatDialog(tableRow);
  }
  
  // Summary
  setTimeout(() => {
    console.log('📊 TEST SUMMARY:');
    console.log(`   API Comments: ${apiComments.length}/5 expected`);
    console.log(`   React Query: ${cacheWorking ? 'Working' : 'Not working'}`);
    console.log(`   Table Row: ${tableRow ? 'Found' : 'Not found'}`);
    
    if (apiComments.length === 5 && cacheWorking && tableRow) {
      console.log('✅ All components working - UI issue must be in message rendering');
    } else {
      console.log('❌ Found issues in test components');
    }
  }, 5000);
}

// Run the test
runCompleteTest();