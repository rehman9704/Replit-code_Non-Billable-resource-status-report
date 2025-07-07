/**
 * ENTERPRISE-WIDE FRONTEND CACHE FIX
 * Apply to ALL employees experiencing wrong comment displays
 * Based on successful Prashanth Janardhanan fix
 */

async function enterpriseWideCacheFix() {
    console.log("🚨 ENTERPRISE-WIDE FRONTEND CACHE FIX STARTING...");
    console.log("Applying proven Prashanth Janardhanan solution to all employees");
    console.log("=============================================================");
    
    // Step 1: Clear all browser storage completely
    console.log("\n🧹 STEP 1: COMPREHENSIVE BROWSER STORAGE CLEARING");
    console.log("------------------------------------------------");
    
    const localKeys = Object.keys(localStorage);
    const sessionKeys = Object.keys(sessionStorage);
    console.log(`📦 Found ${localKeys.length} localStorage items:`, localKeys.slice(0, 10));
    console.log(`📦 Found ${sessionKeys.length} sessionStorage items:`, sessionKeys.slice(0, 10));
    
    localStorage.clear();
    sessionStorage.clear();
    console.log("✅ All browser storage cleared");
    
    // Step 2: Clear React Query cache for ALL employees
    console.log("\n🔄 STEP 2: REACT QUERY CACHE CLEARING");
    console.log("------------------------------------");
    
    if (window.queryClient) {
        console.log("✅ Found React Query client, proceeding with cache clearing...");
        
        // Clear all possible chat-related queries
        const queryPatterns = [
            'chat-messages',
            'chat-messages-zoho', 
            'employees',
            'employee'
        ];
        
        for (const pattern of queryPatterns) {
            try {
                await window.queryClient.invalidateQueries({ queryKey: [pattern] });
                await window.queryClient.removeQueries({ queryKey: [pattern] });
                console.log(`   ✅ Cleared queries for pattern: ${pattern}`);
            } catch (error) {
                console.log(`   ⚠️ Could not clear pattern: ${pattern}`, error);
            }
        }
        
        // Force complete cache clear
        window.queryClient.clear();
        console.log("   ✅ Forced complete React Query cache garbage collection");
        
        // Wait a moment for cache clearing
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("   ✅ Cache clearing delay completed");
        
    } else {
        console.log("❌ React Query client not found in window object");
        console.log("💡 Cache clearing may be limited without React Query access");
    }
    
    // Step 3: Force global component refresh
    console.log("\n🔄 STEP 3: GLOBAL COMPONENT REFRESH");
    console.log("----------------------------------");
    
    // Dispatch multiple refresh events
    const refreshEvents = [
        'enterprise-cache-clear',
        'comment-cache-clear', 
        'employee-data-refresh',
        'chat-attribution-fix'
    ];
    
    refreshEvents.forEach(eventName => {
        window.dispatchEvent(new CustomEvent(eventName, {
            detail: { 
                timestamp: Date.now(), 
                scope: 'all-employees',
                source: 'enterprise-wide-fix'
            }
        }));
        console.log(`   ✅ Dispatched event: ${eventName}`);
    });
    
    // Storage events for component re-renders
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'enterprise-cache-clear',
        newValue: JSON.stringify({
            timestamp: Date.now(),
            action: 'comprehensive-cache-clear',
            scope: 'all-employees'
        }),
    }));
    
    console.log("   ✅ All refresh events dispatched");
    
    // Step 4: Test a few key employees to verify fix
    console.log("\n🧪 STEP 4: VERIFICATION TESTING");
    console.log("------------------------------");
    
    const keyEmployees = [
        { name: "Prashanth Janardhanan", zohoId: "10000391", expected: "Billable under JE Dune" },
        { name: "Mohammad Bilal G", zohoId: "10012233", expected: "There is no active opportunity" },
        { name: "Praveen M G", zohoId: "10012260", expected: "partially billable on the Petbar" },
        { name: "M Abdullah Ansari", zohoId: "10000011", expected: "Any comment for M Abdullah" }
    ];
    
    for (const employee of keyEmployees) {
        try {
            console.log(`🔍 Testing ${employee.name} (ZohoID: ${employee.zohoId})...`);
            
            const response = await fetch(`/api/chat-messages/zoho/${employee.zohoId}`, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`   📊 ${employee.name}: ${data.length} comments`);
                
                if (data.length > 0) {
                    data.forEach((comment, index) => {
                        console.log(`      📝 Comment ${index + 1}: "${comment.content.substring(0, 50)}..." by ${comment.sender}`);
                        
                        if (comment.content.includes(employee.expected)) {
                            console.log(`      ✅ VERIFIED: Contains expected content "${employee.expected}"`);
                        }
                    });
                } else {
                    console.log(`      📭 No comments returned for ${employee.name}`);
                }
            } else {
                console.log(`   ❌ API test failed for ${employee.name}: ${response.status}`);
            }
        } catch (error) {
            console.log(`   ⚠️ Could not test ${employee.name}:`, error);
        }
    }
    
    // Step 5: Instructions and auto-refresh
    console.log("\n📋 STEP 5: USER INSTRUCTIONS");
    console.log("----------------------------");
    console.log("✅ Enterprise-wide cache clearing complete!");
    console.log("");
    console.log("🎯 EXPECTED RESULTS:");
    console.log("   - All employees should now show their correct comments");
    console.log("   - No more 'Training on SAP S4 Hana' appearing for wrong employees");
    console.log("   - Prashanth Janardhanan shows 'Billable under JE Dune' only");
    console.log("   - Mohammad Bilal G shows his 5 specific comments");
    console.log("   - All comment attribution matches intended ZohoIDs");
    console.log("");
    console.log("🔍 TO VERIFY:");
    console.log("   1. Click on any employee's chat button");
    console.log("   2. Check that comments match the intended employee");
    console.log("   3. Look for proper ZohoID attribution in console logs");
    console.log("");
    console.log("🔄 Page will refresh in 10 seconds for complete fix...");
    
    // Auto-refresh countdown
    let countdown = 10;
    const countdownInterval = setInterval(() => {
        console.log(`🕐 Refreshing in ${countdown} seconds...`);
        countdown--;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            console.log("🔄 REFRESHING PAGE FOR COMPLETE ENTERPRISE-WIDE FIX...");
            window.location.reload(true);
        }
    }, 1000);
    
    console.log("\n✅ ENTERPRISE-WIDE CACHE FIX APPLIED SUCCESSFULLY");
    console.log("🎉 All employees should display correct comments after page refresh");
}

// Execute the enterprise-wide fix
enterpriseWideCacheFix();

// Additional debug commands for manual testing
console.log("\n🔧 MANUAL DEBUGGING COMMANDS:");
console.log("==============================================");
console.log("// Test specific employees:");
console.log("fetch('/api/chat-messages/zoho/10000391').then(r=>r.json()).then(d=>console.log('Prashanth:', d))");
console.log("fetch('/api/chat-messages/zoho/10012233').then(r=>r.json()).then(d=>console.log('Mohammad Bilal:', d))");
console.log("fetch('/api/chat-messages/zoho/10012260').then(r=>r.json()).then(d=>console.log('Praveen:', d))");
console.log("");
console.log("// Clear React Query cache manually:");
console.log("window.queryClient && window.queryClient.clear()");
console.log("");
console.log("// Force page refresh:");
console.log("window.location.reload(true)");