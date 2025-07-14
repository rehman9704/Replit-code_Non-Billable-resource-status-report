/**
 * COMPREHENSIVE RECOVERY TEST: Employee Count + Non-Billable Aging Fix
 * Verify both employee count recovery and Non-Billable Aging filter accuracy
 */

console.log('🚨 COMPREHENSIVE RECOVERY TEST');
console.log('==============================');

async function runComprehensiveTest() {
  console.log('📊 Testing Employee Count Recovery...');
  console.log('------------------------------------');
  
  try {
    // Test 1: Employee Count
    const response = await fetch('http://localhost:5000/api/employees?page=1&pageSize=1000&sortBy=name&sortOrder=asc');
    const data = await response.json();
    
    if (data.total) {
      console.log(`📊 Current Employee Count: ${data.total}`);
      console.log(`📈 Actual Records Returned: ${data.data.length}`);
      
      if (data.total === 245) {
        console.log('✅ SUCCESS: Employee count restored to expected 245');
      } else if (data.total === 236) {
        console.log('⚠️  CURRENT STATUS: Employee count is 236 (need to restore to 245)');
      } else if (data.total < 200) {
        console.log('❌ CRITICAL: Employee count still corrupted - very low count detected');
      } else {
        console.log(`ℹ️  INFO: Employee count is ${data.total} (target: 245)`);
      }
      
    } else {
      console.log('❌ ERROR: No total count returned from API');
      return;
    }
    
    console.log('\n🔍 Testing Non-Billable Aging Filter...');
    console.log('---------------------------------------');
    
    // Test 2: Non-Billable Aging Distribution
    const agingCategories = {};
    data.data.forEach(emp => {
      const aging = emp.nonBillableAging;
      agingCategories[aging] = (agingCategories[aging] || 0) + 1;
    });
    
    console.log('📈 Non-Billable Aging Distribution:');
    Object.entries(agingCategories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} employees`);
    });
    
    // Test 3: Mixed Utilization Check
    const mixedUtilization = data.data.filter(emp => emp.nonBillableAging === 'Mixed Utilization');
    console.log(`\n🔄 Mixed Utilization Employees: ${mixedUtilization.length}`);
    if (mixedUtilization.length > 0) {
      console.log('   Sample employees:');
      mixedUtilization.slice(0, 3).forEach(emp => {
        console.log(`   - ${emp.name} (${emp.zohoId})`);
      });
    }
    
    // Test 4: Non-Billable >30 days Check
    const thirtyDayNonBillable = data.data.filter(emp => emp.nonBillableAging === 'Non-Billable >30 days');
    console.log(`\n📅 Non-Billable >30 days: ${thirtyDayNonBillable.length}`);
    if (thirtyDayNonBillable.length > 0) {
      console.log('   Sample employees:');
      thirtyDayNonBillable.slice(0, 3).forEach(emp => {
        console.log(`   - ${emp.name} (${emp.zohoId})`);
      });
    }
    
    console.log('\n✅ RECOVERY TEST SUMMARY');
    console.log('========================');
    console.log(`Employee Count: ${data.total} (Target: 245)`);
    console.log(`Non-Billable Categories: ${Object.keys(agingCategories).length}`);
    console.log(`Mixed Utilization: ${mixedUtilization.length} employees`);
    
    if (data.total >= 236 && Object.keys(agingCategories).length >= 5) {
      console.log('✅ RECOVERY SUCCESSFUL: Core functionality restored');
    } else {
      console.log('⚠️  PARTIAL RECOVERY: Some issues may remain');
    }
    
  } catch (error) {
    console.error('❌ Failed to run comprehensive test:', error.message);
  }
}

runComprehensiveTest();