/**
 * Complete Fix for Prashanth Janardhanan Frontend Cache Issue
 * This script forces the frontend to display the correct comment for Prashanth Janardhanan
 * Database shows: "Billable under JE Dune , Richarson"
 * Frontend incorrectly shows: "Training on SAP S4 Hana - Back up Bench - Less cost"
 */

async function fixPrashanthFrontendCache() {
    console.log("🚨 MANAGEMENT PRIORITY: Fixing Prashanth Janardhanan frontend cache issue");
    console.log("Database has correct comment: 'Billable under JE Dune , Richarson'");
    console.log("Frontend incorrectly shows: 'Training on SAP S4 Hana - Back up Bench - Less cost'");
    
    // Step 1: Clear ALL browser caches for this domain
    console.log("\n🧹 Step 1: Clearing all browser caches...");
    
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage);
    console.log(`📦 Clearing ${localStorageKeys.length} localStorage items:`, localStorageKeys);
    localStorage.clear();
    
    // Clear sessionStorage  
    const sessionStorageKeys = Object.keys(sessionStorage);
    console.log(`📦 Clearing ${sessionStorageKeys.length} sessionStorage items:`, sessionStorageKeys);
    sessionStorage.clear();
    
    // Step 2: Clear React Query cache specifically for Prashanth
    console.log("\n🧹 Step 2: Clearing React Query cache...");
    
    // Find React Query client
    const queryClient = window.queryClient;
    if (queryClient) {
        console.log("✅ Found React Query client, clearing caches:");
        
        // Clear all chat-related queries
        const queries = [
            ['chat-messages-zoho', '10000391'],  // Prashanth's ZohoID
            ['chat-messages', '2'],              // Prashanth's Employee ID
            ['employees'],                       // All employees
            'employees',                         // Legacy employee queries
        ];
        
        for (const query of queries) {
            try {
                await queryClient.invalidateQueries({ queryKey: query });
                await queryClient.removeQueries({ queryKey: query });
                console.log(`   ✅ Cleared cache for query:`, query);
            } catch (error) {
                console.log(`   ❌ Failed to clear query:`, query, error);
            }
        }
        
        // Force cache garbage collection
        queryClient.clear();
        console.log("✅ Forced React Query garbage collection");
    } else {
        console.log("❌ React Query client not found in window");
    }
    
    // Step 3: Test Prashanth's data directly
    console.log("\n🧪 Step 3: Testing Prashanth Janardhanan's data directly...");
    
    try {
        // Test ZohoID-based API (should work)
        console.log("📡 Testing ZohoID-based API...");
        const zohoResponse = await fetch('/api/chat-messages/zoho/10000391', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (zohoResponse.ok) {
            const zohoData = await zohoResponse.json();
            console.log(`✅ ZohoID API returned ${zohoData.length} comments:`, zohoData);
            
            if (zohoData.length > 0) {
                const correctComment = zohoData[0];
                console.log("🎯 CORRECT COMMENT:");
                console.log(`   Content: "${correctComment.content}"`);
                console.log(`   Sender: ${correctComment.sender}`);
                console.log(`   ZohoID: ${correctComment.zohoId}`);
                
                // Verify this is the correct content
                if (correctComment.content.includes("Billable under") && correctComment.content.includes("JE Dune")) {
                    console.log("✅ CONFIRMED: API returns correct 'Billable under JE Dune' comment");
                } else {
                    console.log("🚨 ISSUE: API does not return expected 'Billable under JE Dune' comment");
                }
            } else {
                console.log("❌ No comments returned from ZohoID API");
            }
        } else {
            console.log(`❌ ZohoID API failed: ${zohoResponse.status}`);
        }
        
        // Test Employee ID API (might fail due to endpoint issue)
        console.log("\n📡 Testing Employee ID API...");
        const empResponse = await fetch('/api/employees/2', {
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (empResponse.ok) {
            const empData = await empResponse.json();
            console.log("✅ Employee API response:", empData);
        } else {
            console.log(`❌ Employee API failed: ${empResponse.status} (This is expected - endpoint issue)`);
        }
        
    } catch (error) {
        console.error("❌ Error testing APIs:", error);
    }
    
    // Step 4: Force frontend component refresh
    console.log("\n🔄 Step 4: Forcing frontend component refresh...");
    
    // Method 1: Dispatch storage events to trigger React re-renders
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'prashanth-cache-clear',
        newValue: Date.now().toString(),
    }));
    
    // Method 2: Force page refresh as last resort
    console.log("\n🔄 Step 5: Scheduling page refresh in 3 seconds...");
    console.log("This will ensure all cached data is completely cleared");
    
    setTimeout(() => {
        console.log("🔄 Refreshing page to apply all cache clearance...");
        window.location.reload(true);
    }, 3000);
    
    console.log("\n✅ CACHE CLEARING PROCESS COMPLETE");
    console.log("🎯 Expected result: Prashanth Janardhanan should now show 'Billable under JE Dune , Richarson'");
    console.log("📊 If issue persists, this indicates a deeper component state problem");
}

// Execute the fix
fixPrashanthFrontendCache();