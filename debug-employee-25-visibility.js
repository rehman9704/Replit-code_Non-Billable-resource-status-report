/**
 * Debug Employee 25 (Mohammad Bilal G) Visibility
 * Check if Mohammad Bilal G appears in the employee table and force comment display
 */

console.log('🎯 DEBUGGING EMPLOYEE 25 VISIBILITY...');

async function debugEmployee25() {
  // Step 1: Check API directly
  console.log('📡 Step 1: Testing API for employee 25...');
  
  try {
    const response = await fetch('/api/chat-messages/25');
    const comments = await response.json();
    console.log(`✅ API returned ${comments.length} comments for employee 25`);
    
    if (comments.length > 0) {
      console.log('📝 Comments found:');
      comments.forEach((comment, index) => {
        console.log(`   ${index + 1}. "${comment.content.substring(0, 50)}..." by ${comment.sender}`);
      });
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
  
  // Step 2: Check if employee 25 exists in table
  console.log('🔍 Step 2: Checking table for employee 25...');
  
  const allRows = document.querySelectorAll('table tbody tr');
  let foundEmployee25 = false;
  let mohammadBilalRow = null;
  
  allRows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 1) {
      const nameText = cells[1].textContent;
      
      // Check for Mohammad Bilal specifically
      if (nameText.toLowerCase().includes('mohammad') && nameText.toLowerCase().includes('bilal')) {
        foundEmployee25 = true;
        mohammadBilalRow = row;
        console.log(`✅ Found Mohammad Bilal G at row ${index + 1}: "${nameText}"`);
        
        // Check for comment badge
        const badges = row.querySelectorAll('.bg-blue-500, .bg-red-500, [class*="badge"]');
        badges.forEach(badge => {
          console.log(`   📊 Comment badge: "${badge.textContent}"`);
        });
        
        // Force click chat button
        const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"]');
        if (chatButton) {
          console.log('💬 Chat button found - clicking to open dialog...');
          chatButton.click();
          
          setTimeout(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              console.log('✅ Dialog opened for Mohammad Bilal G');
              
              // Check dialog content
              const messageElements = dialog.querySelectorAll('[class*="space-y-6"] > div');
              console.log(`📱 Dialog shows ${messageElements.length} message elements`);
              
              if (messageElements.length === 0) {
                console.log('❌ No messages displayed in dialog despite API having comments');
                console.log('🔍 Dialog content:', dialog.textContent.substring(0, 200));
              } else {
                console.log('✅ Messages displayed in dialog:');
                messageElements.forEach((element, index) => {
                  const text = element.textContent.trim();
                  if (text.length > 10) {
                    console.log(`   📝 Message ${index + 1}: "${text.substring(0, 80)}..."`);
                  }
                });
              }
              
              // Close dialog
              setTimeout(() => {
                const closeButton = dialog.querySelector('button[aria-label="Close"]');
                if (closeButton) {
                  closeButton.click();
                  console.log('🔒 Dialog closed');
                }
              }, 2000);
              
            } else {
              console.log('❌ Dialog did not open');
            }
          }, 1000);
        } else {
          console.log('❌ Chat button not found for Mohammad Bilal G');
        }
      }
    }
  });
  
  if (!foundEmployee25) {
    console.log('❌ Mohammad Bilal G not found in current table view');
    console.log('🔍 Available employees in table (first 20):');
    
    allRows.forEach((row, index) => {
      if (index < 20) {
        const cells = row.querySelectorAll('td');
        if (cells.length > 1) {
          console.log(`   ${index + 1}: ${cells[1].textContent}`);
        }
      }
    });
    
    // Check if pagination or filtering is hiding employee 25
    const paginationInfo = document.querySelector('[class*="pagination"], [class*="page"]');
    if (paginationInfo) {
      console.log('📄 Pagination detected:', paginationInfo.textContent);
    }
    
    const filterInputs = document.querySelectorAll('input[type="text"], select');
    if (filterInputs.length > 0) {
      console.log('🔽 Active filters detected - employee 25 might be filtered out');
    }
  }
  
  // Step 3: Check React Query cache
  console.log('💾 Step 3: Checking React Query cache...');
  
  if (window.queryClient) {
    const cacheData = window.queryClient.getQueryData(['chat-messages', '25']);
    console.log('📊 Cache data for employee 25:', cacheData);
    
    // Force refetch
    window.queryClient.invalidateQueries({ queryKey: ['chat-messages', '25'] });
    console.log('🔄 Cache invalidated for employee 25');
  }
  
  console.log('📊 EMPLOYEE 25 DEBUG COMPLETE');
}

// Run the debug
debugEmployee25();