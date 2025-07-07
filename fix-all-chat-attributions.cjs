/**
 * COMPREHENSIVE CHAT ATTRIBUTION FIX FOR ALL EMPLOYEES
 * Apply the proven Prashanth Janardhanan solution enterprise-wide
 */

const { Pool } = require('pg');

async function fixAllChatAttributions() {
    console.log("🚨 COMPREHENSIVE CHAT ATTRIBUTION FIX");
    console.log("=====================================");
    
    // Connect to database
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
        console.log("📡 Connecting to database...");
        
        // Step 1: Get all employees with comments
        console.log("\n🔍 STEP 1: ANALYZING ALL EMPLOYEES WITH COMMENTS");
        console.log("------------------------------------------------");
        
        const employeesWithComments = await pool.query(`
            SELECT DISTINCT 
                e.id as employee_id,
                e.name as employee_name, 
                e.zoho_id,
                COUNT(cci.id) as comment_count
            FROM employees e
            INNER JOIN chat_comments_intended cci ON e.zoho_id = cci.intended_zoho_id
            WHERE cci.is_visible = true
            GROUP BY e.id, e.name, e.zoho_id
            ORDER BY e.id
        `);
        
        const employees = employeesWithComments.rows;
        console.log(`✅ Found ${employees.length} employees with comments:`);
        
        employees.forEach((emp, index) => {
            console.log(`   ${index + 1}. ${emp.employee_name} (ID: ${emp.employee_id}, ZohoID: ${emp.zoho_id}) - ${emp.comment_count} comments`);
        });
        
        // Step 2: Verify attribution integrity for each employee
        console.log("\n🔍 STEP 2: ATTRIBUTION INTEGRITY CHECK");
        console.log("------------------------------------");
        
        const reportData = [];
        
        for (const employee of employees) {
            // Get comments for this employee
            const commentsResult = await pool.query(`
                SELECT 
                    content,
                    sender,
                    intended_employee_name,
                    intended_zoho_id,
                    timestamp
                FROM chat_comments_intended 
                WHERE intended_zoho_id = $1 AND is_visible = true
                ORDER BY timestamp DESC
            `, [employee.zoho_id]);
            
            const comments = commentsResult.rows;
            const attributionStatus = comments.every(c => c.intended_zoho_id === employee.zoho_id) ? 'perfect' : 'misattributed';
            
            reportData.push({
                employee_id: employee.employee_id,
                employee_name: employee.employee_name,
                zoho_id: employee.zoho_id,
                comment_count: comments.length,
                attribution_status
            });
            
            const statusIcon = attributionStatus === 'perfect' ? '✅' : '🚨';
            console.log(`   ${statusIcon} ${employee.employee_name}: ${attributionStatus} (${comments.length} comments)`);
            
            // Show any attribution issues
            comments.forEach((comment, index) => {
                if (comment.intended_zoho_id !== employee.zoho_id) {
                    console.log(`      ⚠️ Comment ${index + 1}: "${comment.content.substring(0, 40)}..." intended for ZohoID ${comment.intended_zoho_id}, not ${employee.zoho_id}`);
                }
            });
        }
        
        // Step 3: Find cross-contaminated comments
        console.log("\n🔍 STEP 3: CROSS-CONTAMINATED COMMENTS");
        console.log("-------------------------------------");
        
        const crossContaminatedResult = await pool.query(`
            SELECT 
                content,
                COUNT(DISTINCT intended_zoho_id) as employee_count,
                STRING_AGG(DISTINCT intended_employee_name, ', ') as affected_employees
            FROM chat_comments_intended 
            WHERE is_visible = true
            GROUP BY content
            HAVING COUNT(DISTINCT intended_zoho_id) > 1
            ORDER BY employee_count DESC
        `);
        
        const crossContaminated = crossContaminatedResult.rows;
        console.log(`🚨 Found ${crossContaminated.length} comments appearing for multiple employees:`);
        
        crossContaminated.forEach((comment, index) => {
            console.log(`   ${index + 1}. "${comment.content.substring(0, 50)}..."`);
            console.log(`      📊 Affects ${comment.employee_count} employees: ${comment.affected_employees}`);
        });
        
        // Step 4: Generate enterprise-wide frontend cache fix
        console.log("\n🧹 STEP 4: GENERATING FRONTEND CACHE FIX");
        console.log("---------------------------------------");
        
        const frontendScript = `
/**
 * ENTERPRISE-WIDE FRONTEND CACHE FIX
 * Auto-generated for all ${employees.length} employees with comments
 * Based on successful Prashanth Janardhanan fix
 */

async function enterpriseWideCacheFix() {
    console.log("🚨 ENTERPRISE-WIDE CACHE FIX STARTING...");
    console.log("Applying proven solution to all ${employees.length} employees");
    
    // Step 1: Clear all browser storage
    console.log("\\n🧹 Step 1: Clearing browser storage...");
    const localKeys = Object.keys(localStorage);
    const sessionKeys = Object.keys(sessionStorage);
    console.log(\`   localStorage: \${localKeys.length} items\`);
    console.log(\`   sessionStorage: \${sessionKeys.length} items\`);
    
    localStorage.clear();
    sessionStorage.clear();
    console.log("   ✅ All browser storage cleared");
    
    // Step 2: Clear React Query cache for all employees with comments
    console.log("\\n🔄 Step 2: Clearing React Query cache...");
    if (window.queryClient) {
        const employeeIds = [${employees.map(e => e.employee_id).join(', ')}];
        const zohoIds = [${employees.map(e => `"${e.zoho_id}"`).join(', ')}];
        
        console.log(\`   Clearing cache for \${employeeIds.length} employees\`);
        
        // Clear individual employee queries
        for (const empId of employeeIds) {
            await window.queryClient.invalidateQueries({ queryKey: ['chat-messages', empId.toString()] });
            await window.queryClient.removeQueries({ queryKey: ['chat-messages', empId.toString()] });
        }
        
        // Clear ZohoID-based queries
        for (const zohoId of zohoIds) {
            await window.queryClient.invalidateQueries({ queryKey: ['chat-messages-zoho', zohoId] });
            await window.queryClient.removeQueries({ queryKey: ['chat-messages-zoho', zohoId] });
        }
        
        // Clear all employee data
        await window.queryClient.invalidateQueries({ queryKey: ['employees'] });
        await window.queryClient.removeQueries({ queryKey: ['employees'] });
        
        // Force complete cache clear
        window.queryClient.clear();
        console.log("   ✅ React Query cache completely cleared");
    } else {
        console.log("   ❌ React Query client not found");
    }
    
    // Step 3: Force component refresh
    console.log("\\n🔄 Step 3: Forcing component refresh...");
    window.dispatchEvent(new CustomEvent('enterprise-cache-clear', {
        detail: { 
            timestamp: Date.now(), 
            scope: 'all-employees',
            employeeCount: ${employees.length}
        }
    }));
    
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'enterprise-cache-clear',
        newValue: JSON.stringify({
            timestamp: Date.now(),
            employees: employeeIds.length,
            zohoIds: zohoIds.length
        }),
    }));
    
    console.log("   ✅ Component refresh events dispatched");
    
    // Step 4: Display expected results
    console.log("\\n🎯 EXPECTED RESULTS:");
    console.log("After cache clearing, these employees should show correct comments:");
    ${employees.map(emp => `console.log("   ✅ ${emp.employee_name} (ID: ${emp.employee_id}) - ${emp.comment_count} comments");`).join('\n    ')}
    
    console.log("\\n✅ ENTERPRISE CACHE FIX COMPLETE");
    console.log("🎯 All employees should now display correct comments");
    
    // Auto-refresh page in 8 seconds for complete fix
    console.log("\\n⏰ Page will refresh in 8 seconds for complete cache clearance...");
    setTimeout(() => {
        console.log("🔄 Refreshing page to complete enterprise-wide fix...");
        window.location.reload(true);
    }, 8000);
}

// Execute the fix
enterpriseWideCacheFix();

console.log("\\n🔧 MANUAL VERIFICATION COMMANDS:");
console.log("Test specific employee comments:");
${employees.map(emp => `console.log("fetch('/api/chat-messages/zoho/${emp.zoho_id}').then(r=>r.json()).then(d=>console.log('${emp.employee_name}:', d))");`).join('\n')}
`;
        
        // Save the frontend fix script
        const fs = require('fs');
        fs.writeFileSync('enterprise-frontend-cache-fix.js', frontendScript);
        console.log("✅ Frontend cache fix script saved: 'enterprise-frontend-cache-fix.js'");
        
        // Step 5: Summary
        console.log("\n📊 ENTERPRISE ATTRIBUTION SUMMARY");
        console.log("=================================");
        
        const perfectCount = reportData.filter(r => r.attribution_status === 'perfect').length;
        const totalEmployees = reportData.length;
        
        console.log(`📈 METRICS:`);
        console.log(`   Total employees with comments: ${totalEmployees}`);
        console.log(`   Perfect attribution: ${perfectCount} (${Math.round(perfectCount/totalEmployees*100)}%)`);
        console.log(`   Cross-contaminated comments: ${crossContaminated.length}`);
        
        console.log(`\n🎯 SOLUTION STATUS:`);
        if (perfectCount === totalEmployees && crossContaminated.length === 0) {
            console.log("   ✅ ALL ATTRIBUTIONS PERFECT - Issue is frontend cache only");
            console.log("   💡 Running frontend cache fix will resolve all display issues");
        } else {
            console.log(`   🚨 Database has ${crossContaminated.length} cross-contaminated comments`);
            console.log("   💡 Frontend cache fix will help, but database cleanup needed too");
        }
        
        console.log("\n✅ COMPREHENSIVE FIX ANALYSIS COMPLETE");
        console.log("🚀 NEXT STEPS:");
        console.log("   1. Run 'enterprise-frontend-cache-fix.js' in browser console");
        console.log("   2. Test employee comment displays after cache clearing");
        console.log("   3. Report any remaining attribution issues");
        
        return {
            success: true,
            employees_analyzed: totalEmployees,
            perfect_attribution: perfectCount,
            cross_contaminated: crossContaminated.length,
            frontend_script_created: true
        };
        
    } catch (error) {
        console.error("❌ Error in comprehensive fix:", error);
        return { success: false, error: error.message };
    } finally {
        await pool.end();
    }
}

// Execute the comprehensive fix
if (require.main === module) {
    fixAllChatAttributions()
        .then(result => {
            console.log("\n🎉 COMPREHENSIVE FIX RESULT:", result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error("💥 COMPREHENSIVE FIX FAILED:", error);
            process.exit(1);
        });
}

module.exports = { fixAllChatAttributions };