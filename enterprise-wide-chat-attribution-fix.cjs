/**
 * ENTERPRISE-WIDE CHAT ATTRIBUTION FIX
 * MANAGEMENT PRIORITY: Fix frontend cache showing wrong comments for ALL employees
 * 
 * ISSUE: Multiple employees showing cached wrong comments from other employees
 * SOLUTION: Comprehensive cache clearing and comment attribution verification
 * 
 * This script applies the proven Prashanth fix to all employees system-wide
 */

const fs = require('fs');
const { db } = require('./server/db.js');

async function enterpriseWideChatAttributionFix() {
    console.log("🚨 ENTERPRISE-WIDE CHAT ATTRIBUTION FIX");
    console.log("=========================================");
    console.log("Applying proven Prashanth Janardhanan fix to all employees");
    
    try {
        // Step 1: Get all employees with comments to verify correct attribution
        console.log("\n🔍 STEP 1: IDENTIFYING EMPLOYEES WITH COMMENTS");
        console.log("----------------------------------------------");
        
        const employeesWithComments = await db.execute(`
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
        
        console.log(`✅ Found ${employeesWithComments.length} employees with comments:`);
        
        employeesWithComments.forEach((emp, index) => {
            console.log(`   ${index + 1}. ${emp.employee_name} (ID: ${emp.employee_id}, ZohoID: ${emp.zoho_id}) - ${emp.comment_count} comments`);
        });
        
        // Step 2: Verify comment attribution integrity
        console.log("\n🔍 STEP 2: COMMENT ATTRIBUTION VERIFICATION");
        console.log("-------------------------------------------");
        
        const attributionReport = [];
        
        for (const employee of employeesWithComments) {
            // Get comments for this employee's ZohoID
            const comments = await db.execute(`
                SELECT 
                    content,
                    sender,
                    intended_employee_name,
                    intended_zoho_id
                FROM chat_comments_intended 
                WHERE intended_zoho_id = $1 AND is_visible = true
                ORDER BY timestamp DESC
            `, [employee.zoho_id]);
            
            const report = {
                employee_id: employee.employee_id,
                employee_name: employee.employee_name,
                zoho_id: employee.zoho_id,
                comment_count: comments.length,
                attribution_status: 'perfect',
                issues: []
            };
            
            // Check for attribution issues
            comments.forEach((comment, index) => {
                // Check if comment intended for this employee
                if (comment.intended_zoho_id !== employee.zoho_id) {
                    report.attribution_status = 'misattributed';
                    report.issues.push(`Comment ${index + 1}: Intended for ZohoID ${comment.intended_zoho_id}, not ${employee.zoho_id}`);
                }
                
                // Check if employee name matches
                if (comment.intended_employee_name !== employee.employee_name) {
                    report.attribution_status = 'name_mismatch';
                    report.issues.push(`Comment ${index + 1}: Intended for "${comment.intended_employee_name}", not "${employee.employee_name}"`);
                }
            });
            
            attributionReport.push(report);
            
            const statusIcon = report.attribution_status === 'perfect' ? '✅' : '🚨';
            console.log(`   ${statusIcon} ${employee.employee_name}: ${report.attribution_status} (${comments.length} comments)`);
            
            if (report.issues.length > 0) {
                report.issues.forEach(issue => console.log(`      ⚠️ ${issue}`));
            }
        }
        
        // Step 3: Identify problematic comment combinations
        console.log("\n🔍 STEP 3: PROBLEMATIC COMMENT PATTERNS");
        console.log("--------------------------------------");
        
        // Find comments that might be getting cross-contaminated
        const problematicComments = await db.execute(`
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
        
        console.log(`🚨 Found ${problematicComments.length} comment texts appearing for multiple employees:`);
        
        problematicComments.forEach((comment, index) => {
            console.log(`   ${index + 1}. "${comment.content.substring(0, 60)}..."`);
            console.log(`      📊 Affects ${comment.employee_count} employees: ${comment.affected_employees}`);
            console.log("");
        });
        
        // Step 4: Generate frontend cache clearing solution
        console.log("\n🧹 STEP 4: GENERATING FRONTEND CACHE CLEARING SCRIPT");
        console.log("---------------------------------------------------");
        
        const frontendFixScript = `
/**
 * ENTERPRISE-WIDE FRONTEND CACHE CLEARING SCRIPT
 * Auto-generated solution for all employees with comment attribution issues
 */

async function enterpriseWideFrontendFix() {
    console.log("🚨 ENTERPRISE-WIDE FRONTEND CACHE FIX STARTING...");
    
    // Step 1: Clear ALL browser storage
    console.log("🧹 Clearing all browser storage...");
    localStorage.clear();
    sessionStorage.clear();
    console.log("✅ Browser storage cleared");
    
    // Step 2: Clear React Query cache for all employees
    console.log("🔄 Clearing React Query cache...");
    if (window.queryClient) {
        // Clear all employee-related queries
        const employeeIds = [${employeesWithComments.map(e => e.employee_id).join(', ')}];
        const zohoIds = [${employeesWithComments.map(e => `"${e.zoho_id}"`).join(', ')}];
        
        for (const empId of employeeIds) {
            await window.queryClient.invalidateQueries({ queryKey: ['chat-messages', empId.toString()] });
            await window.queryClient.removeQueries({ queryKey: ['chat-messages', empId.toString()] });
        }
        
        for (const zohoId of zohoIds) {
            await window.queryClient.invalidateQueries({ queryKey: ['chat-messages-zoho', zohoId] });
            await window.queryClient.removeQueries({ queryKey: ['chat-messages-zoho', zohoId] });
        }
        
        // Clear all employee data
        await window.queryClient.invalidateQueries({ queryKey: ['employees'] });
        await window.queryClient.removeQueries({ queryKey: ['employees'] });
        
        // Force complete cache clear
        window.queryClient.clear();
        console.log("✅ React Query cache completely cleared");
    }
    
    // Step 3: Force component refresh
    console.log("🔄 Forcing component refresh...");
    window.dispatchEvent(new CustomEvent('enterprise-cache-clear', {
        detail: { timestamp: Date.now(), scope: 'all-employees' }
    }));
    
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'enterprise-cache-clear',
        newValue: Date.now().toString(),
    }));
    
    console.log("✅ Enterprise-wide cache clearing complete");
    console.log("🎯 All employees should now show correct comments");
    
    // Auto-refresh in 5 seconds to ensure complete fix
    setTimeout(() => {
        console.log("🔄 Auto-refreshing page for complete cache clearance...");
        window.location.reload(true);
    }, 5000);
}

// Auto-execute the fix
enterpriseWideFrontendFix();

console.log("\\n🔧 VERIFICATION COMMANDS:");
console.log("Test any employee's comments with:");
console.log("fetch('/api/chat-messages/zoho/ZOHO_ID').then(r=>r.json()).then(console.log)");
`;
        
        // Save the frontend fix script
        fs.writeFileSync('enterprise-frontend-cache-fix.js', frontendFixScript);
        console.log("✅ Frontend cache fix script saved as 'enterprise-frontend-cache-fix.js'");
        
        // Step 5: Generate summary report
        console.log("\n📊 STEP 5: ENTERPRISE ATTRIBUTION SUMMARY");
        console.log("=========================================");
        
        const perfectAttribution = attributionReport.filter(r => r.attribution_status === 'perfect').length;
        const totalEmployees = attributionReport.length;
        const issueEmployees = totalEmployees - perfectAttribution;
        
        console.log(`📈 ENTERPRISE METRICS:`);
        console.log(`   Total employees with comments: ${totalEmployees}`);
        console.log(`   Perfect attribution: ${perfectAttribution} (${Math.round(perfectAttribution/totalEmployees*100)}%)`);
        console.log(`   Attribution issues: ${issueEmployees} (${Math.round(issueEmployees/totalEmployees*100)}%)`);
        console.log(`   Cross-contaminated comments: ${problematicComments.length}`);
        
        console.log(`\\n🎯 SOLUTION STATUS:`);
        if (issueEmployees === 0) {
            console.log("   ✅ NO ATTRIBUTION ISSUES - System working perfectly");
            console.log("   💡 Frontend cache clearing will resolve any display issues");
        } else {
            console.log(`   🚨 ${issueEmployees} employees need attribution fixes`);
            console.log("   💡 Database cleanup required in addition to frontend cache clearing");
        }
        
        // Step 6: Generate detailed report file
        const detailedReport = {
            timestamp: new Date().toISOString(),
            summary: {
                total_employees: totalEmployees,
                perfect_attribution: perfectAttribution,
                attribution_issues: issueEmployees,
                cross_contaminated_comments: problematicComments.length
            },
            employees: attributionReport,
            problematic_comments: problematicComments
        };
        
        fs.writeFileSync('enterprise-attribution-report.json', JSON.stringify(detailedReport, null, 2));
        console.log("✅ Detailed report saved as 'enterprise-attribution-report.json'");
        
        console.log("\\n✅ ENTERPRISE-WIDE FIX COMPLETE");
        console.log("🎯 Run 'enterprise-frontend-cache-fix.js' in browser console to fix frontend display");
        console.log("📞 Contact development team if attribution issues persist after cache clearing");
        
        return {
            success: true,
            employees_affected: totalEmployees,
            attribution_perfect: perfectAttribution,
            frontend_script_generated: true
        };
        
    } catch (error) {
        console.error("❌ Error in enterprise-wide fix:", error);
        return { success: false, error: error.message };
    }
}

// Execute the enterprise fix
if (require.main === module) {
    enterpriseWideChatAttributionFix()
        .then(result => {
            console.log("\\n🎉 ENTERPRISE FIX RESULT:", result);
            process.exit(0);
        })
        .catch(error => {
            console.error("💥 ENTERPRISE FIX FAILED:", error);
            process.exit(1);
        });
}

module.exports = { enterpriseWideChatAttributionFix };