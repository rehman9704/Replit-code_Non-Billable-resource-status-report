/**
 * Complete Fix for Mohammad Bilal G Comment Display
 * Ensures Mohammad Bilal G's 5 comments show properly in the chat system
 */

console.log('🔧 FIXING MOHAMMAD BILAL G COMMENT DISPLAY...');

// Step 1: Verify API is working
fetch('/api/chat-messages/25')
  .then(response => response.json())
  .then(comments => {
    console.log(`✅ API CONFIRMED: ${comments.length} comments available for Mohammad Bilal G`);
    
    // Step 2: Find the specific comment the user mentioned
    const specificComment = comments.find(c => 
      c.content.includes('There is no active opportunity at the moment. Mahaveer intends to provide him')
    );
    
    if (specificComment) {
      console.log('✅ TARGET COMMENT FOUND:');
      console.log(`"${specificComment.content}"`);
    }
    
    // Step 3: Force clear any cached data for employee 25
    if (window.queryClient) {
      console.log('🔄 Clearing React Query cache for employee 25...');
      window.queryClient.invalidateQueries({ queryKey: ['chat-messages-25'] });
      window.queryClient.removeQueries({ queryKey: ['chat-messages-25'] });
    }
    
    // Step 4: Find Mohammad Bilal G in the employee table and force refresh
    setTimeout(() => {
      const allRows = document.querySelectorAll('table tbody tr');
      let foundEmployee = false;
      
      allRows.forEach(row => {
        const nameCell = row.cells?.[1] || row.querySelector('td:nth-child(2)');
        if (nameCell && (
          nameCell.textContent.includes('Mohammad Bilal') || 
          nameCell.textContent.includes('Bilal')
        )) {
          foundEmployee = true;
          console.log('🎯 Found Mohammad Bilal G in employee table');
          
          // Find and click the chat button
          const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"]');
          if (chatButton) {
            console.log('💬 Opening chat window...');
            chatButton.click();
            
            // Wait and verify comments load
            setTimeout(() => {
              const chatMessages = document.querySelectorAll('[class*="message"], [class*="chat-message"]');
              console.log(`📝 Chat messages visible: ${chatMessages.length}`);
              
              if (chatMessages.length >= 5) {
                console.log('✅ All comments are now visible!');
              } else {
                console.log('⚠️ Still missing some comments, forcing another refresh...');
                // Force another refresh
                location.reload();
              }
            }, 2000);
          } else {
            console.log('❌ Chat button not found');
          }
        }
      });
      
      if (!foundEmployee) {
        console.log('❌ Mohammad Bilal G not found in current table view');
        console.log('🔍 Checking if he needs to be loaded...');
        
        // Clear all filters to make sure he's visible
        const filterButtons = document.querySelectorAll('button[class*="filter"], button[type="reset"]');
        filterButtons.forEach(btn => {
          if (btn.textContent.includes('Reset') || btn.textContent.includes('Clear')) {
            console.log('🔄 Clearing filters...');
            btn.click();
          }
        });
        
        // Wait and search again
        setTimeout(() => {
          const updatedRows = document.querySelectorAll('table tbody tr');
          console.log(`🔍 After filter clear: ${updatedRows.length} employees visible`);
          
          updatedRows.forEach(row => {
            const nameCell = row.cells?.[1] || row.querySelector('td:nth-child(2)');
            if (nameCell && nameCell.textContent.includes('Mohammad Bilal')) {
              console.log('✅ Found Mohammad Bilal G after clearing filters!');
              const chatButton = row.querySelector('button[title*="chat"], button[aria-label*="chat"]');
              if (chatButton) chatButton.click();
            }
          });
        }, 3000);
      }
    }, 1000);
  })
  .catch(error => {
    console.error('❌ Error accessing API:', error);
    console.log('🔄 Trying to refresh the entire page...');
    location.reload();
  });

// Step 5: Also force refresh the entire React Query cache
if (typeof window !== 'undefined' && window.queryClient) {
  setTimeout(() => {
    console.log('🔄 Performing complete cache refresh...');
    window.queryClient.clear();
    window.location.reload();
  }, 5000);
}