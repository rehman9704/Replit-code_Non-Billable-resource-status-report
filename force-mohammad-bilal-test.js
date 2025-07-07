/**
 * Force Mohammad Bilal G Test - Complete End-to-End Verification
 */

console.log('🎯 FORCING MOHAMMAD BILAL G TEST...');

async function forceMohammadBilalTest() {
  // Step 1: Verify API endpoint
  console.log('📡 Step 1: Testing API endpoint directly...');
  try {
    const response = await fetch('/api/chat-messages/25');
    const data = await response.json();
    console.log(`✅ API Response: ${data.length} comments for employee 25`);
    
    if (data.length === 5) {
      console.log('✅ All 5 comments found in API');
      
      // Find the target comment
      const targetComment = data.find(c => 
        c.content.includes('There is no active opportunity at the moment')
      );
      
      if (targetComment) {
        console.log('✅ TARGET COMMENT FOUND:', targetComment.content);
      }
    } else {
      console.log('❌ Expected 5 comments, got:', data.length);
    }
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
  
  // Step 2: Find Mohammad Bilal G in the employee table
  console.log('🔍 Step 2: Finding Mohammad Bilal G in table...');
  
  const rows = document.querySelectorAll('table tbody tr');
  let targetRow = null;
  let rowIndex = -1;
  
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 1) {
      const nameText = cells[1].textContent.toLowerCase();
      if (nameText.includes('mohammad') && nameText.includes('bilal')) {
        targetRow = row;
        rowIndex = index;
        console.log(`✅ Found Mohammad Bilal G at row ${index + 1}`);
        console.log(`   Full name: "${cells[1].textContent}"`);
        
        // Check if there's a comment count badge
        const badges = row.querySelectorAll('.bg-blue-500, .bg-red-500, [class*="badge"]');
        badges.forEach(badge => {
          console.log(`   📊 Comment badge: "${badge.textContent}"`);
        });
      }
    }
  });
  
  if (!targetRow) {
    console.log('❌ Mohammad Bilal G not found in table');
    console.log('🔍 Available employees (first 10):');
    
    rows.forEach((row, index) => {
      if (index < 10) {
        const cells = row.querySelectorAll('td');
        if (cells.length > 1) {
          console.log(`   ${index + 1}: ${cells[1].textContent}`);
        }
      }
    });
    return;
  }
  
  // Step 3: Force open chat dialog for Mohammad Bilal G
  console.log('💬 Step 3: Opening chat dialog...');
  
  const chatButton = targetRow.querySelector('button[title*="chat"], button[aria-label*="chat"]');
  if (!chatButton) {
    console.log('❌ Chat button not found');
    return;
  }
  
  console.log('🖱️ Clicking chat button...');
  chatButton.click();
  
  // Step 4: Verify dialog content
  setTimeout(() => {
    console.log('🔍 Step 4: Checking dialog content...');
    
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) {
      console.log('❌ Dialog not opened');
      return;
    }
    
    console.log('✅ Dialog opened successfully');
    
    // Look for message content
    const messageElements = dialog.querySelectorAll('[class*="space-y-6"] > div');
    console.log(`📱 Found ${messageElements.length} message elements`);
    
    if (messageElements.length === 0) {
      console.log('❌ No message elements found');
      console.log('🔍 Dialog text content:', dialog.textContent.substring(0, 200));
      
      // Check for "No comments yet" message
      if (dialog.textContent.includes('No comments yet')) {
        console.log('⚠️ "No comments yet" message displayed - UI issue confirmed');
      }
    } else {
      console.log('✅ Message elements found:');
      
      messageElements.forEach((element, index) => {
        const text = element.textContent.trim();
        if (text.length > 10) {
          console.log(`   📝 Message ${index + 1}: "${text.substring(0, 100)}..."`);
        }
      });
      
      // Check for target comment
      const targetFound = Array.from(messageElements).some(el => 
        el.textContent.includes('There is no active opportunity at the moment')
      );
      
      if (targetFound) {
        console.log('✅ TARGET COMMENT FOUND IN UI!');
      } else {
        console.log('❌ Target comment not found in UI');
      }
    }
    
    // Close dialog after test
    setTimeout(() => {
      const closeButton = dialog.querySelector('button[aria-label="Close"]');
      if (closeButton) {
        closeButton.click();
        console.log('🔒 Dialog closed');
      }
    }, 2000);
    
  }, 1500);
  
  // Summary
  setTimeout(() => {
    console.log('📊 MOHAMMAD BILAL G TEST COMPLETE');
  }, 4000);
}

// Run the test
forceMohammadBilalTest();