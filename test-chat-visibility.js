/**
 * COMPREHENSIVE CHAT VISIBILITY TEST
 * Tests end-to-end chat functionality for employees with comments
 */

console.log('🔍 COMPREHENSIVE CHAT VISIBILITY TEST');
console.log('====================================');

// Test employees who should have comments based on database
const testEmployees = [
    { name: 'Jatin Udasi', zohoId: '10114291', expectedComments: 8 },
    { name: 'Laxmi Pavani', zohoId: '10013228', expectedComments: 7 },
    { name: 'Mohammad Bilal G', zohoId: '10012233', expectedComments: 5 },
    { name: 'Praveen M G', zohoId: '10012260', expectedComments: 4 },
    { name: 'M Abdullah Ansari', zohoId: '10000011', expectedComments: 3 },
    { name: 'Aakash Gupta', zohoId: '10013595', expectedComments: 0 }, // Now in database
    { name: 'Gurjeet Kaur', zohoId: '10114370', expectedComments: 0 }, // Should be in database
    { name: 'Hassan Hussain', zohoId: '10013277', expectedComments: 0 } // Should be in database
];

async function testChatVisibility() {
    console.log('🎯 TESTING CHAT API ENDPOINTS');
    console.log('-----------------------------');
    
    for (const employee of testEmployees) {
        try {
            console.log(`\n📋 Testing: ${employee.name} (ZohoID: ${employee.zohoId})`);
            
            // Test ZohoID-based API endpoint
            const response = await fetch(`/api/chat-messages/zoho/${employee.zohoId}`);
            const comments = await response.json();
            
            console.log(`   API Status: ${response.status}`);
            console.log(`   Comments returned: ${comments.length}`);
            console.log(`   Expected comments: ${employee.expectedComments}`);
            
            if (comments.length === employee.expectedComments) {
                console.log(`   ✅ CORRECT: Comment count matches expected`);
            } else {
                console.log(`   🚨 MISMATCH: Expected ${employee.expectedComments}, got ${comments.length}`);
            }
            
            // Show first comment if any exist
            if (comments.length > 0) {
                console.log(`   📝 First comment: "${comments[0].content.substring(0, 50)}..." by ${comments[0].sender}`);
            }
            
        } catch (error) {
            console.error(`   ❌ ERROR testing ${employee.name}:`, error);
        }
    }
}

async function testFrontendChatInterface() {
    console.log('\n🎯 TESTING FRONTEND CHAT INTERFACE');
    console.log('----------------------------------');
    
    // Check if chat buttons are visible in the table
    const chatButtons = document.querySelectorAll('[role="dialog"]');
    console.log(`Chat dialog triggers found: ${chatButtons.length}`);
    
    // Check for comment count badges
    const badges = document.querySelectorAll('.bg-blue-100, .bg-green-100, .bg-red-100');
    console.log(`Comment count badges found: ${badges.length}`);
    
    // Check for any visible error messages
    const errorElements = document.querySelectorAll('[role="alert"], .text-red-500, .text-destructive');
    console.log(`Error elements found: ${errorElements.length}`);
    
    if (errorElements.length > 0) {
        console.log('🚨 FRONTEND ERRORS DETECTED:');
        errorElements.forEach((el, index) => {
            console.log(`   Error ${index + 1}: ${el.textContent.substring(0, 100)}`);
        });
    }
}

async function checkEmployeeTableData() {
    console.log('\n🎯 CHECKING EMPLOYEE TABLE DATA');
    console.log('-------------------------------');
    
    try {
        const response = await fetch('/api/employees?pageSize=1000');
        const data = await response.json();
        
        console.log(`Total employees in API: ${data.employees.length}`);
        console.log(`Total rows reported: ${data.totalRows}`);
        
        // Check for our test employees
        testEmployees.forEach(testEmp => {
            const found = data.employees.find(emp => emp.zohoId === testEmp.zohoId);
            if (found) {
                console.log(`✅ ${testEmp.name} found in employee list (ID: ${found.id})`);
            } else {
                console.log(`❌ ${testEmp.name} NOT found in employee list`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching employee data:', error);
    }
}

// Run all tests
async function runAllTests() {
    try {
        await testChatVisibility();
        await testFrontendChatInterface();
        await checkEmployeeTableData();
        
        console.log('\n🎯 SUMMARY');
        console.log('----------');
        console.log('✅ Chat API tests completed');
        console.log('✅ Frontend interface checks completed');
        console.log('✅ Employee data verification completed');
        console.log('\nIf chat is still not visible, check browser console for React errors.');
        
    } catch (error) {
        console.error('❌ Test suite error:', error);
    }
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
    runAllTests();
} else {
    console.log('Run this script in the browser console to test chat visibility');
}