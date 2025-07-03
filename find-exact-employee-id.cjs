/**
 * Find Exact Employee ID for Laxmi Pavani
 * This script uses the backend API to find the exact employee ID that corresponds to Zoho 10013228
 */

const http = require('http');

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': 'connect.sid=s%3AgqfmNHHWGK6vd1kRyEAJpHXxb9hbJSZ1.4DPObIlO%2B3QHdxjUP%2B9RGPfOiHjIKJN9HvVCe%2FU8sF0', // Use a valid session cookie if available
        'User-Agent': 'Employee-ID-Finder'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve(null);
    });

    req.end();
  });
}

async function findLaxmiEmployeeId() {
  console.log('🔍 Searching for Laxmi Pavani employee ID...');
  
  try {
    // Get all employees and search for Zoho ID 10013228
    const response = await makeRequest('/api/employees?pageSize=1000');
    
    if (response && response.data) {
      console.log(`📊 Retrieved ${response.data.length} employees`);
      
      // Find Laxmi Pavani by Zoho ID
      const laxmi = response.data.find(emp => 
        emp.zohoId === '10013228' || 
        emp.name?.toLowerCase().includes('laxmi') ||
        emp.name?.toLowerCase().includes('pavani')
      );
      
      if (laxmi) {
        console.log('🎯 FOUND LAXMI PAVANI:');
        console.log(`   Employee ID: ${laxmi.id}`);
        console.log(`   Name: ${laxmi.name}`);
        console.log(`   Zoho ID: ${laxmi.zohoId}`);
        console.log(`   Department: ${laxmi.department}`);
        console.log(`   Status: ${laxmi.status}`);
        
        return laxmi.id;
      } else {
        console.log('❌ Laxmi Pavani not found in employee data');
        
        // Show a sample of employees for debugging
        console.log('\n📋 Sample employees:');
        response.data.slice(0, 5).forEach(emp => {
          console.log(`   ID: ${emp.id}, Name: ${emp.name}, Zoho: ${emp.zohoId}`);
        });
      }
    } else {
      console.log('❌ Failed to retrieve employee data');
      console.log('Response:', response);
    }
    
  } catch (error) {
    console.error('❌ Error finding Laxmi employee ID:', error);
  }
  
  return null;
}

// Run the search
findLaxmiEmployeeId();