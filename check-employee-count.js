/**
 * EMERGENCY: Check Employee Count Recovery
 * Verify that the employee count has been restored to 245 from corrupted state
 */

console.log('🚨 EMPLOYEE COUNT RECOVERY TEST');
console.log('================================');

async function checkEmployeeCount() {
  try {
    console.log('⏱️ Fetching employee count...');
    
    const response = await fetch('http://localhost:5000/api/employees?page=1&pageSize=1000&sortBy=name&sortOrder=asc');
    const data = await response.json();
    
    if (data.total) {
      console.log(`📊 Current Employee Count: ${data.total}`);
      console.log(`📈 Actual Records Returned: ${data.data.length}`);
      
      if (data.total === 245) {
        console.log('✅ SUCCESS: Employee count restored to expected 245');
      } else if (data.total < 100) {
        console.log('❌ CRITICAL: Employee count still corrupted - very low count detected');
      } else if (data.total < 245) {
        console.log('⚠️  WARNING: Employee count partially recovered but still below 245');
      } else {
        console.log('ℹ️  INFO: Employee count is higher than expected 245');
      }
      
      // Sample employee verification
      console.log('\n📋 Sample Employee Verification:');
      console.log('-------------------------------');
      data.data.slice(0, 5).forEach((emp, index) => {
        console.log(`${index + 1}. ${emp.name} (ZohoID: ${emp.zohoId}) - ${emp.department}`);
      });
      
    } else {
      console.log('❌ ERROR: No total count returned from API');
    }
    
  } catch (error) {
    console.error('❌ Failed to check employee count:', error.message);
  }
}

checkEmployeeCount();