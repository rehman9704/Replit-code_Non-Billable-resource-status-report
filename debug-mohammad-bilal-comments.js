/**
 * Debug Mohammad Bilal G Comments Display
 * This script directly checks if Mohammad Bilal G's comments are showing properly
 */

console.log('🔍 DEBUGGING MOHAMMAD BILAL G COMMENTS (Employee ID: 25, ZohoID: 10012233)');

// Direct API call to verify comments are available
fetch('/api/chat-messages/25')
  .then(response => response.json())
  .then(comments => {
    console.log(`✅ API RESPONSE: Found ${comments.length} comments for Mohammad Bilal G:`);
    
    comments.forEach((comment, index) => {
      console.log(`📝 Comment ${index + 1}:`);
      console.log(`   Sender: ${comment.sender}`);
      console.log(`   Content: ${comment.content}`);
      console.log(`   Date: ${new Date(comment.timestamp).toLocaleDateString()}`);
      console.log(`   ZohoID: ${comment.zohoId}`);
      console.log('');
    });
    
    // Look for the specific comment user mentioned
    const specificComment = comments.find(c => 
      c.content.includes('There is no active opportunity at the moment. Mahaveer intends to provide him')
    );
    
    if (specificComment) {
      console.log('✅ FOUND SPECIFIC COMMENT:');
      console.log(`   "${specificComment.content}"`);
      console.log(`   By: ${specificComment.sender}`);
      console.log(`   Date: ${new Date(specificComment.timestamp).toLocaleDateString()}`);
    } else {
      console.log('❌ SPECIFIC COMMENT NOT FOUND');
    }
    
    // Check if employee exists in current dashboard view
    const employeeRows = document.querySelectorAll('[data-employee-id="25"]');
    console.log(`🔍 Employee ID 25 found in dashboard: ${employeeRows.length} elements`);
    
    if (employeeRows.length > 0) {
      console.log('✅ Mohammad Bilal G is visible in current dashboard view');
      
      // Try to find and click the chat button
      const chatButton = document.querySelector('[data-employee-id="25"] button[aria-label*="chat"], [data-employee-id="25"] button[title*="chat"]');
      if (chatButton) {
        console.log('🎯 Found chat button - attempting to open chat');
        chatButton.click();
      } else {
        console.log('⚠️ Chat button not found for employee 25');
      }
    } else {
      console.log('⚠️ Mohammad Bilal G (Employee ID 25) not visible in current dashboard view');
      console.log('   This could be due to filtering, pagination, or employee not being in current dataset');
    }
  })
  .catch(error => {
    console.error('❌ Error fetching comments:', error);
  });

// Also check the employee table for Mohammad Bilal G
setTimeout(() => {
  const allRows = document.querySelectorAll('table tbody tr');
  console.log(`🔍 Total employee rows in table: ${allRows.length}`);
  
  let foundMohammadBilal = false;
  allRows.forEach((row, index) => {
    const nameCell = row.querySelector('td:first-child, td:nth-child(2)');
    if (nameCell && nameCell.textContent.includes('Mohammad Bilal')) {
      foundMohammadBilal = true;
      console.log(`✅ Found Mohammad Bilal G in row ${index + 1}`);
      console.log(`   Row content: ${nameCell.textContent}`);
      
      // Look for chat indicator
      const messageCount = row.querySelector('[class*="message"], [class*="chat"], [class*="comment"]');
      if (messageCount) {
        console.log(`💬 Chat indicator found: ${messageCount.textContent}`);
      }
    }
  });
  
  if (!foundMohammadBilal) {
    console.log('❌ Mohammad Bilal G not found in current table view');
    console.log('   Checking if he might be on another page or filtered out...');
  }
}, 1000);