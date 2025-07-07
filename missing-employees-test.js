
/**
 * MISSING EMPLOYEES COMMENT DISPLAY FIX
 * Handle comments for employees not in current active employees table
 */

async function handleMissingEmployeeComments() {
    console.log("🚨 MISSING EMPLOYEES COMMENT FIX");
    console.log("================================");
    
    // Test specific missing employees
    const missingEmployees = [
        { name: "Syamala Haritha Kolisetty", zohoId: "10013105" },
        // Add other missing employees as needed
    ];
    
    for (const employee of missingEmployees) {
        console.log(`\n🔍 Testing ${employee.name} (ZohoID: ${employee.zohoId})...`);
        
        try {
            const response = await fetch(`/api/chat-messages/zoho/${employee.zohoId}`, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`   📊 API returned ${data.length} comments for ${employee.name}`);
                
                if (data.length > 0) {
                    data.forEach((comment, index) => {
                        console.log(`      📝 Comment ${index + 1}: "${comment.content.substring(0, 50)}..." by ${comment.sender}`);
                    });
                } else {
                    console.log(`   ❌ No comments returned - employee may not exist in active table`);
                }
            } else {
                console.log(`   ❌ API request failed: ${response.status}`);
            }
        } catch (error) {
            console.log(`   ⚠️ Error testing ${employee.name}:`, error);
        }
    }
    
    console.log("\n✅ Missing employee comments test complete");
}

// Execute the test
handleMissingEmployeeComments();
