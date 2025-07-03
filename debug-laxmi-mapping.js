/**
 * Debug Laxmi Pavani Employee ID Mapping
 * Finds the correct employee ID for Laxmi Pavani (Zoho: 10013228) in Azure SQL Database
 */

import { AzureSqlStorage } from './server/storage-backup.ts';

async function debugLaxmiMapping() {
  console.log('🔍 DEBUGGING LAXMI PAVANI EMPLOYEE ID MAPPING');
  console.log('=' .repeat(50));
  
  try {
    // Using the Azure SQL Database connection
    const storage = new AzureSqlStorage();
    
    // Get all employees and find Laxmi Pavani
    console.log('📊 Fetching all employees from Azure SQL Database...');
    const result = await storage.getEmployees({ page: 1, pageSize: 5000 });
    
    console.log(`✅ Total employees found: ${result.total}`);
    
    // Find Laxmi Pavani by Zoho ID
    const laxmi = result.data.find(emp => emp.zohoId === '10013228');
    
    if (laxmi) {
      console.log('\n🎯 LAXMI PAVANI FOUND:');
      console.log('Employee ID:', laxmi.id);
      console.log('Name:', laxmi.name);
      console.log('Zoho ID:', laxmi.zohoId);
      console.log('Department:', laxmi.department);
      console.log('Status:', laxmi.status);
      console.log('Business Unit:', laxmi.businessUnit);
      console.log('Client:', laxmi.clientSecurity);
      
      // Check messages in PostgreSQL for this employee ID
      console.log('\n🔍 Checking PostgreSQL chat messages for employee ID:', laxmi.id);
      
    } else {
      console.log('\n❌ LAXMI PAVANI NOT FOUND in Azure SQL Database');
      
      // Search by partial name match
      const partialMatches = result.data.filter(emp => 
        emp.name && emp.name.toLowerCase().includes('laxmi')
      );
      
      if (partialMatches.length > 0) {
        console.log('\n🔍 PARTIAL NAME MATCHES:');
        partialMatches.forEach(emp => {
          console.log(`- ID: ${emp.id}, Name: ${emp.name}, Zoho: ${emp.zohoId}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

debugLaxmiMapping();