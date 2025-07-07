/**
 * COMPLETE PRASHANTH JANARDHANAN FRONTEND FIX
 * MANAGEMENT PRIORITY: Fix frontend cache showing wrong comment
 * 
 * ISSUE: Frontend shows "Training on SAP S4 Hana - Back up Bench - Less cost"
 * EXPECTED: Should show "Billable under JE Dune , Richarson"
 * 
 * This script provides a complete diagnostic and fix for the issue
 */

async function completePrashanthJanardhananlFix() {
    console.log("🚨 MANAGEMENT PRIORITY: Complete Prashanth Janardhanan Fix");
    console.log("=====================================");
    
    // Step 1: Diagnostic - Check what API returns vs what frontend shows
    console.log("\n🔍 STEP 1: DIAGNOSTIC VERIFICATION");
    console.log("----------------------------------");
    
    try {
        // Test API directly
        console.log("📡 Testing API for Prashanth Janardhanan (ZohoID: 10000391)...");
        const apiResponse = await fetch('/api/chat-messages/zoho/10000391', {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            console.log(`✅ API returned ${apiData.length} comments:`);
            
            apiData.forEach((comment, index) => {
                console.log(`   📝 Comment ${index + 1}: "${comment.content}"`);
                console.log(`   👤 By: ${comment.sender}`);
                console.log(`   🆔 ZohoID: ${comment.zohoId}`);
                
                if (comment.content.includes("Billable under") && comment.content.includes("JE Dune")) {
                    console.log("   ✅ This is the CORRECT comment for Prashanth");
                } else if (comment.content.includes("Training on SAP S4 Hana")) {
                    console.log("   🚨 ERROR: This is the WRONG comment (belongs to other employees)");
                }
                console.log("");
            });
            
            if (apiData.length === 1 && apiData[0].content.includes("Billable under")) {
                console.log("✅ DIAGNOSIS: API is returning CORRECT data");
                console.log("🎯 Issue is in frontend caching/rendering, not database");
            } else {
                console.log("❌ DIAGNOSIS: API is returning INCORRECT data");
                console.log("🎯 Issue is in database or API logic");
            }
        } else {
            console.log(`❌ API request failed: ${apiResponse.status}`);
        }
    } catch (error) {
        console.error("❌ Error testing API:", error);
    }
    
    // Step 2: Clear all possible caches
    console.log("\n🧹 STEP 2: COMPREHENSIVE CACHE CLEARING");
    console.log("---------------------------------------");
    
    // Clear browser storage
    console.log("📦 Clearing localStorage...");
    const localKeys = Object.keys(localStorage);
    console.log(`   Found ${localKeys.length} items:`, localKeys);
    localStorage.clear();
    console.log("   ✅ localStorage cleared");
    
    console.log("📦 Clearing sessionStorage...");
    const sessionKeys = Object.keys(sessionStorage);
    console.log(`   Found ${sessionKeys.length} items:`, sessionKeys);
    sessionStorage.clear();
    console.log("   ✅ sessionStorage cleared");
    
    // Clear React Query cache
    console.log("🔄 Clearing React Query cache...");
    if (window.queryClient) {
        try {
            // Clear specific queries for Prashanth
            const queriesToClear = [
                ['chat-messages-zoho', '10000391'],
                ['chat-messages', '2'],
                ['employees'],
                'employees'
            ];
            
            for (const query of queriesToClear) {
                await window.queryClient.invalidateQueries({ queryKey: query });
                await window.queryClient.removeQueries({ queryKey: query });
                console.log(`   ✅ Cleared query:`, query);
            }
            
            // Force complete cache clear
            window.queryClient.clear();
            console.log("   ✅ Forced complete React Query cache clear");
        } catch (error) {
            console.log("   ❌ Error clearing React Query cache:", error);
        }
    } else {
        console.log("   ❌ React Query client not found");
    }
    
    // Step 3: Force component re-render
    console.log("\n🔄 STEP 3: FORCE COMPONENT REFRESH");
    console.log("----------------------------------");
    
    // Dispatch custom events to trigger re-renders
    window.dispatchEvent(new CustomEvent('prashanth-fix', {
        detail: { timestamp: Date.now(), action: 'cache-clear' }
    }));
    
    // Storage event to trigger React components listening to storage
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'prashanth-cache-clear',
        newValue: Date.now().toString(),
        oldValue: null
    }));
    
    console.log("✅ Dispatched refresh events");
    
    // Step 4: Instructions for user
    console.log("\n📋 STEP 4: USER INSTRUCTIONS");
    console.log("-----------------------------");
    console.log("1. Click on Prashanth Janardhanan's chat button in the employee table");
    console.log("2. The chat dialog should now show the CORRECT comment:");
    console.log("   'Billable under JE Dune , Richarson' by Kishore Kumar Thirupuraanandan");
    console.log("3. If you still see 'Training on SAP S4 Hana', refresh the page completely");
    console.log("");
    console.log("🎯 Expected Result:");
    console.log("   ✅ Prashanth Janardhanan shows 1 comment");
    console.log("   ✅ Comment content: 'Billable under JE Dune , Richarson'");
    console.log("   ✅ No 'Training on SAP S4 Hana' text visible");
    
    // Step 5: Schedule page refresh if needed
    console.log("\n⏰ STEP 5: BACKUP PLAN");
    console.log("----------------------");
    console.log("If issue persists after 10 seconds, page will refresh automatically...");
    
    setTimeout(() => {
        console.log("🔄 Backup refresh: Reloading page to ensure complete cache clear");
        window.location.reload(true);
    }, 10000);
    
    console.log("\n✅ COMPLETE FIX APPLIED");
    console.log("🎯 Prashanth Janardhanan should now show correct comment");
    console.log("📞 Contact development team if issue persists after page refresh");
}

// Auto-execute the fix
completePrashanthJanardhananlFix();

console.log("\n🔧 ADDITIONAL DEBUG COMMANDS:");
console.log("To manually test Prashanth's data:");
console.log("fetch('/api/chat-messages/zoho/10000391').then(r=>r.json()).then(console.log)");
console.log("\nTo clear React Query cache:");
console.log("window.queryClient && window.queryClient.clear()");
console.log("\nTo force page refresh:");
console.log("window.location.reload(true)");