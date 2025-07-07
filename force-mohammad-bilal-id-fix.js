/**
 * CRITICAL MOHAMMAD BILAL G ID FIX - MANAGEMENT PRIORITY
 * Forces Mohammad Bilal G to use correct Employee ID 25 instead of wrong ID 76
 */

// CRITICAL ISSUE IDENTIFIED: Frontend requests Employee ID 76 instead of 25 for Mohammad Bilal G
// DATABASE CONFIRMED: Mohammad Bilal G (ZohoID: 10012233) has actual_employee_id = 25 with all 5 comments
// API CONFIRMED: /api/chat-messages/25 returns all 5 comments, /api/chat-messages/76 returns empty array

async function forceMohammadBilalIdFix() {
  console.log(`🚨 MOHAMMAD BILAL G CRITICAL ID FIX - MANAGEMENT PRIORITY`);
  
  // Step 1: Clear React Query cache completely
  console.log(`1️⃣ CLEARING REACT QUERY CACHE`);
  if (window.queryClient) {
    window.queryClient.clear();
    console.log(`✅ React Query cache cleared`);
  }
  
  // Step 2: Find Mohammad Bilal G in the employee table
  console.log(`2️⃣ LOCATING MOHAMMAD BILAL G IN TABLE`);
  const rows = document.querySelectorAll('tbody tr');
  let mohammadBilalRow = null;
  
  for (let row of rows) {
    const nameCell = row.querySelector('td');
    if (nameCell && nameCell.textContent.includes('Mohammad Bilal G')) {
      mohammadBilalRow = row;
      console.log(`✅ Found Mohammad Bilal G row:`, nameCell.textContent);
      break;
    }
  }
  
  if (!mohammadBilalRow) {
    console.log(`❌ Mohammad Bilal G not found in employee table`);
    return;
  }
  
  // Step 3: Test API endpoints directly
  console.log(`3️⃣ TESTING API ENDPOINTS DIRECTLY`);
  
  try {
    // Test Employee ID 25 (correct)
    const response25 = await fetch('/api/chat-messages/25');
    const data25 = await response25.json();
    console.log(`✅ Employee ID 25 (CORRECT): ${data25.length} comments`);
    console.log(`✅ Target comment exists:`, data25.some(m => m.content.includes('There is no active opportunity')));
    
    // Test Employee ID 76 (wrong)
    const response76 = await fetch('/api/chat-messages/76');
    const data76 = await response76.json();
    console.log(`❌ Employee ID 76 (WRONG): ${data76.length} comments`);
    
    // Step 4: Force open chat dialog with correct Employee ID
    console.log(`4️⃣ FORCING CHAT DIALOG WITH CORRECT ID 25`);
    
    // Create a mock click event with the correct employee data
    const chatButton = mohammadBilalRow.querySelector('[aria-label="View comments"]');
    if (chatButton) {
      console.log(`✅ Found chat button for Mohammad Bilal G`);
      
      // Manually trigger the chat component with correct ID
      const event = new CustomEvent('openChat', {
        detail: {
          employeeId: '25',  // FORCE CORRECT ID
          employeeName: 'Mohammad Bilal G',
          zohoId: '10012233'
        }
      });
      
      chatButton.dispatchEvent(event);
      console.log(`✅ Dispatched chat event with correct Employee ID 25`);
      
      // Also click the button normally
      chatButton.click();
      console.log(`✅ Clicked chat button`);
      
    } else {
      console.log(`❌ Chat button not found for Mohammad Bilal G`);
    }
    
    // Step 5: Wait and verify the fix
    setTimeout(async () => {
      console.log(`5️⃣ VERIFYING MOHAMMAD BILAL G CHAT WINDOW`);
      
      const chatDialog = document.querySelector('[role="dialog"]');
      if (chatDialog) {
        console.log(`✅ Chat dialog opened`);
        
        // Check if the correct number of messages appears
        const messageElements = chatDialog.querySelectorAll('.space-y-6 > div');
        console.log(`✅ Messages in UI: ${messageElements.length}`);
        
        // Look for the target comment
        const targetCommentExists = Array.from(chatDialog.querySelectorAll('.text-gray-800')).some(el => 
          el.textContent.includes('There is no active opportunity')
        );
        
        if (targetCommentExists) {
          console.log(`🎉 SUCCESS: Mohammad Bilal G target comment now visible!`);
        } else {
          console.log(`❌ Target comment still not visible - need frontend ID mapping fix`);
        }
        
      } else {
        console.log(`❌ Chat dialog did not open`);
      }
    }, 2000);
    
  } catch (error) {
    console.error(`❌ API test failed:`, error);
  }
}

// Execute the fix
forceMohammadBilalIdFix();