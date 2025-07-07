/**
 * Direct Test for Mohammad Bilal G Comments
 * Bypasses all caching and directly tests API and UI
 */

console.log('🎯 TESTING MOHAMMAD BILAL G COMMENTS DIRECTLY...');

// Test 1: Direct API call
async function testDirectAPI() {
  console.log('📡 Step 1: Testing direct API call...');
  
  try {
    const response = await fetch('/api/chat-messages/25');
    const comments = await response.json();
    
    console.log(`✅ API Success: ${comments.length} comments returned`);
    console.log('📋 Comments received:', comments);
    
    if (comments.length >= 5) {
      console.log('✅ All 5 comments present in API response');
      
      // Look for the specific comment mentioned by user
      const targetComment = comments.find(c => 
        c.content.includes('There is no active opportunity at the moment')
      );
      
      if (targetComment) {
        console.log('✅ TARGET COMMENT FOUND:', targetComment.content);
      } else {
        console.log('❌ Target comment not found');
      }
      
      return comments;
    } else {
      console.log('❌ Expected 5 comments, got:', comments.length);
      return comments;
    }
  } catch (error) {
    console.error('❌ API test failed:', error);
    return [];
  }
}

// Test 2: Clear React Query cache for employee 25
function clearReactQueryCache() {
  console.log('🧹 Step 2: Clearing React Query cache...');
  
  if (window.queryClient) {
    window.queryClient.invalidateQueries({ queryKey: ['chat-messages', '25'] });
    window.queryClient.removeQueries({ queryKey: ['chat-messages', '25'] });
    window.queryClient.invalidateQueries({ queryKey: ['chat-messages', 25] });
    window.queryClient.removeQueries({ queryKey: ['chat-messages', 25] });
    console.log('✅ React Query cache cleared for employee 25');
    return true;
  } else {
    console.log('❌ React Query client not available');
    return false;
  }
}

// Test 3: Find Mohammad Bilal G in the table
function findMohammadBilalInTable() {
  console.log('🔍 Step 3: Finding Mohammad Bilal G in table...');
  
  const rows = document.querySelectorAll('table tbody tr');
  let targetRow = null;
  
  rows.forEach((row, index) => {
    const nameCell = row.querySelector('td:nth-child(2)');
    if (nameCell && nameCell.textContent.toLowerCase().includes('mohammad bilal')) {
      targetRow = row;
      console.log(`✅ Found Mohammad Bilal G in row ${index + 1}`);
      console.log(`   Full name displayed: "${nameCell.textContent}"`);
      
      // Check for message count badge
      const badges = row.querySelectorAll('[class*="badge"], [class*="count"], .bg-blue-500, .bg-red-500');
      badges.forEach(badge => {
        console.log(`   📊 Badge found: "${badge.textContent}"`);
      });
      
      return true;
    }
  });
  
  if (!targetRow) {
    console.log('❌ Mohammad Bilal G not found in table');
    console.log('🔍 Available employees in table:');
    
    rows.forEach((row, index) => {
      const nameCell = row.querySelector('td:nth-child(2)');
      if (nameCell && index < 10) { // Show first 10
        console.log(`   ${index + 1}: ${nameCell.textContent}`);
      }
    });
  }
  
  return targetRow;
}

// Test 4: Force open chat dialog
function forceOpenChatDialog(row) {
  if (!row) {
    console.log('❌ Cannot open dialog - row not found');
    return false;
  }
  
  console.log('💬 Step 4: Force opening chat dialog...');
  
  const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"], button[class*="chat"]');
  if (chatButton) {
    console.log('🖱️ Chat button found, clicking...');
    chatButton.click();
    
    setTimeout(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        console.log('✅ Chat dialog opened');
        
        // Look for message elements
        const messageContainer = dialog.querySelector('[class*="space-y-6"]');
        if (messageContainer) {
          const messageElements = messageContainer.children;
          console.log(`📱 Found ${messageElements.length} message elements in dialog`);
          
          Array.from(messageElements).forEach((element, index) => {
            if (element.textContent.length > 10) {
              console.log(`   📝 Message ${index + 1}: "${element.textContent.substring(0, 100)}..."`);
            }
          });
          
          if (messageElements.length === 0) {
            console.log('⚠️ No message elements found in dialog');
            console.log('🔍 Dialog content:', dialog.textContent.substring(0, 200));
          }
        } else {
          console.log('❌ Message container not found in dialog');
        }
        
        return true;
      } else {
        console.log('❌ Dialog not opened');
        return false;
      }
    }, 1000);
  } else {
    console.log('❌ Chat button not found');
    return false;
  }
}

// Run complete test sequence
async function runCompleteTest() {
  console.log('🚀 Starting complete Mohammad Bilal G test sequence...');
  
  // Step 1: Test API
  const apiComments = await testDirectAPI();
  
  // Step 2: Clear cache
  const cacheCleared = clearReactQueryCache();
  
  // Step 3: Find in table
  const tableRow = findMohammadBilalInTable();
  
  // Step 4: Open dialog
  const dialogOpened = forceOpenChatDialog(tableRow);
  
  // Summary
  setTimeout(() => {
    console.log('📊 TEST RESULTS SUMMARY:');
    console.log(`   API Comments: ${apiComments.length}/5 expected`);
    console.log(`   Cache Cleared: ${cacheCleared ? 'Yes' : 'No'}`);
    console.log(`   Found in Table: ${tableRow ? 'Yes' : 'No'}`);
    console.log(`   Dialog Opened: ${dialogOpened ? 'Yes' : 'No'}`);
    
    if (apiComments.length === 5 && tableRow) {
      console.log('✅ Mohammad Bilal G should have working comments');
    } else {
      console.log('❌ Issues detected in Mohammad Bilal G setup');
    }
  }, 3000);
}

// Execute test
runCompleteTest();