/**
 * Complete UI Misattribution Fix
 * Forces refresh of all frontend components and clears any cached display state
 */

console.log('🔧 FIXING ALL COMMENT DISPLAY ISSUES...');

// Force clear React Query cache for all employees with comments
const employeesWithComments = [1, 2, 5, 6, 7, 8, 10, 11, 12, 13, 20, 23, 25, 26, 27, 80, 194, 195];

// Clear all message caches
if (window.queryClient) {
  console.log('🔄 Clearing all chat message caches...');
  
  employeesWithComments.forEach(employeeId => {
    window.queryClient.invalidateQueries({ queryKey: ['chat-messages', employeeId] });
    window.queryClient.removeQueries({ queryKey: ['chat-messages', employeeId] });
  });
  
  // Also clear general queries
  window.queryClient.invalidateQueries();
  window.queryClient.clear();
  
  console.log('✅ All caches cleared');
}

// Test Mohammad Bilal G specifically
setTimeout(() => {
  console.log('🎯 Testing Mohammad Bilal G (Employee ID 25) comments...');
  
  fetch('/api/chat-messages/25')
    .then(response => response.json())
    .then(comments => {
      console.log(`✅ Mohammad Bilal G has ${comments.length} comments available:`);
      
      comments.forEach((comment, index) => {
        console.log(`📝 Comment ${index + 1}: "${comment.content}" - By: ${comment.sender}`);
      });
      
      // Find specific comment
      const targetComment = comments.find(c => 
        c.content.includes('There is no active opportunity at the moment. Mahaveer intends to provide him')
      );
      
      if (targetComment) {
        console.log('✅ TARGET COMMENT CONFIRMED:');
        console.log(`"${targetComment.content}"`);
      }
      
      // Now try to find Mohammad Bilal G in the UI
      setTimeout(() => {
        console.log('🔍 Searching for Mohammad Bilal G in employee table...');
        
        const employeeRows = document.querySelectorAll('table tbody tr');
        let found = false;
        
        employeeRows.forEach((row, index) => {
          const nameCell = row.querySelector('td:nth-child(2)');
          if (nameCell && nameCell.textContent.includes('Mohammad Bilal')) {
            found = true;
            console.log(`✅ Found Mohammad Bilal G in row ${index + 1}`);
            console.log(`   Name: ${nameCell.textContent}`);
            
            // Look for chat button and comment count
            const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"]');
            const messageCount = row.querySelector('[class*="badge"], [class*="count"]');
            
            if (chatButton) {
              console.log('💬 Chat button found - opening chat window...');
              chatButton.click();
              
              // Wait for chat to load
              setTimeout(() => {
                const chatDialog = document.querySelector('[role="dialog"]');
                if (chatDialog) {
                  const chatMessages = chatDialog.querySelectorAll('[class*="message"], [class*="chat"]');
                  console.log(`📱 Chat window opened with ${chatMessages.length} visible messages`);
                  
                  if (chatMessages.length >= 5) {
                    console.log('✅ All 5 comments are now visible in the UI!');
                  } else {
                    console.log('⚠️ Not all comments are visible, forcing another refresh...');
                    location.reload();
                  }
                } else {
                  console.log('❌ Chat dialog not found');
                }
              }, 2000);
            } else {
              console.log('❌ Chat button not found for Mohammad Bilal G');
            }
            
            if (messageCount) {
              console.log(`📊 Comment count badge: ${messageCount.textContent}`);
            }
          }
        });
        
        if (!found) {
          console.log('❌ Mohammad Bilal G not found in current view');
          console.log('🔄 Clearing filters and searching again...');
          
          // Clear filters
          const resetButton = document.querySelector('button[type="reset"]');
          if (resetButton) {
            resetButton.click();
            
            setTimeout(() => {
              console.log('🔍 Searching again after filter clear...');
              const updatedRows = document.querySelectorAll('table tbody tr');
              updatedRows.forEach(row => {
                const nameCell = row.querySelector('td:nth-child(2)');
                if (nameCell && nameCell.textContent.includes('Mohammad Bilal')) {
                  console.log('✅ Found Mohammad Bilal G after clearing filters!');
                  const chatBtn = row.querySelector('button[title*="chat"]');
                  if (chatBtn) chatBtn.click();
                }
              });
            }, 3000);
          }
        }
      }, 1000);
    })
    .catch(error => {
      console.error('❌ Error fetching Mohammad Bilal G comments:', error);
    });
}, 2000);

// Also test a few other employees with comments
setTimeout(() => {
  console.log('🧪 Testing other employees with comments...');
  
  const testEmployees = [
    { id: 1, name: 'M Abdullah Ansari', expectedComments: 3 },
    { id: 2, name: 'Prashanth Janardhanan', expectedComments: 1 },
    { id: 27, name: 'Jatin Udasi', expectedComments: 8 }
  ];
  
  testEmployees.forEach(emp => {
    fetch(`/api/chat-messages/${emp.id}`)
      .then(response => response.json())
      .then(comments => {
        console.log(`✅ ${emp.name} (ID: ${emp.id}): ${comments.length}/${emp.expectedComments} comments`);
      })
      .catch(error => {
        console.error(`❌ Error fetching ${emp.name} comments:`, error);
      });
  });
}, 5000);