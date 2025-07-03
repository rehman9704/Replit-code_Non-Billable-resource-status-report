// Find Laxmi Pavani's employee ID using the API
const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function findLaxmi() {
  try {
    console.log('Searching for Laxmi Pavani...');
    
    // Try different search approaches
    const searches = [
      '/api/employees?search=Laxmi&pageSize=50',
      '/api/employees?search=Pavani&pageSize=50',
      '/api/employees?search=10013228&pageSize=50'
    ];
    
    for (const search of searches) {
      console.log(`\nTrying: ${search}`);
      const result = await makeRequest(search);
      
      if (result.data && result.data.length > 0) {
        console.log(`Found ${result.data.length} results:`);
        result.data.forEach(emp => {
          console.log(`- ID: ${emp.id}, Name: ${emp.name}, Zoho: ${emp.zohoId}`);
        });
      } else {
        console.log('No results found');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findLaxmi();