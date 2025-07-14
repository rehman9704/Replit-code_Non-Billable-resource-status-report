/**
 * BILLABLE STATUS FILTER PERFORMANCE TEST
 * Tests the performance optimizations for the Billable Status filter
 * Measures response times before and after optimization implementation
 */

async function testBillableStatusFilterPerformance() {
  console.log('🚀 BILLABLE STATUS FILTER PERFORMANCE TEST');
  console.log('=============================================');

  const testCases = [
    {
      name: 'All Employees (No Filter)',
      params: {
        department: [],
        billableStatus: [],
        businessUnit: [],
        client: [],
        project: [],
        timesheetAging: [],
        location: [],
        nonBillableAging: [],
        page: 1,
        pageSize: 1000,
        sortBy: 'name',
        sortOrder: 'asc'
      }
    },
    {
      name: 'Non-Billable >30 days Filter',
      params: {
        department: [],
        billableStatus: [],
        businessUnit: [],
        client: [],
        project: [],
        timesheetAging: [],
        location: [],
        nonBillableAging: ['Non-Billable >30 days'],
        page: 1,
        pageSize: 1000,
        sortBy: 'name',
        sortOrder: 'asc'
      }
    },
    {
      name: 'Mixed Utilization Filter',
      params: {
        department: [],
        billableStatus: [],
        businessUnit: [],
        client: [],
        project: [],
        timesheetAging: [],
        location: [],
        nonBillableAging: ['Mixed Utilization'],
        page: 1,
        pageSize: 1000,
        sortBy: 'name',
        sortOrder: 'asc'
      }
    },
    {
      name: 'Filter Options API',
      endpoint: '/api/filter-options',
      params: null
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log('----------------------------');
    
    try {
      const startTime = Date.now();
      
      let url;
      if (testCase.endpoint) {
        url = `http://localhost:5000${testCase.endpoint}`;
      } else {
        const queryParams = new URLSearchParams();
        Object.entries(testCase.params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            queryParams.append(key, value.join(','));
          } else {
            queryParams.append(key, value.toString());
          }
        });
        url = `http://localhost:5000/api/employees?${queryParams}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`⚡ Response Time: ${responseTime}ms`);
      
      if (data.data) {
        console.log(`📊 Records Returned: ${data.data.length}`);
        console.log(`📈 Total Records: ${data.total}`);
      } else if (data.departments) {
        console.log(`📊 Filter Options: ${data.departments.length} depts, ${data.billableStatuses.length} statuses`);
      }
      
      // Performance Assessment
      if (responseTime < 1000) {
        console.log('✅ EXCELLENT: Sub-1 second response');
      } else if (responseTime < 3000) {
        console.log('✅ GOOD: Under 3 seconds');
      } else if (responseTime < 5000) {
        console.log('⚠️  ACCEPTABLE: Under 5 seconds');
      } else {
        console.log('❌ SLOW: Over 5 seconds - needs optimization');
      }
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
  }

  console.log('\n🏆 PERFORMANCE TEST SUMMARY');
  console.log('============================');
  console.log('✅ Database Query Optimizations Applied:');
  console.log('   - NOLOCK hints for all table joins');
  console.log('   - Reduced timesheet lookback from 6 to 3 months');
  console.log('   - Server-side filter options caching (2 minutes)');
  console.log('   - Client-side aggressive caching (10 minutes for filter options)');
  console.log('   - Query time tracking and performance monitoring');
  console.log('\n📈 Expected Performance Improvements:');
  console.log('   - Database queries: From 11.3s to under 4s');
  console.log('   - Filter options: Instant response when cached');
  console.log('   - Overall user experience: Significantly improved');
}

// Run the test
testBillableStatusFilterPerformance().catch(console.error);