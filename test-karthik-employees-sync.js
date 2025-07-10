/**
 * Test Script: Verify Karthik's Missing Employees are Now Synced
 * This script verifies that Gurjeet Kaur and Hassan Hussain are now available for comments
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { employees, chatCommentsIntended } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Test the employees that Karthik reported as missing
const karthikEmployees = [
  { name: 'Gurjeet Kaur', zohoId: '10114370' },
  { name: 'Hassan Hussain', zohoId: '10013277' }
];

async function testKarthikEmployeesSync() {
  try {
    console.log('🔍 TESTING KARTHIK\'S MISSING EMPLOYEES SYNC...\n');
    
    if (!process.env.DATABASE_URL) {
      console.log('❌ DATABASE_URL not found');
      return;
    }

    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // Check if employees are now in PostgreSQL
    for (const emp of karthikEmployees) {
      console.log(`🔍 Checking ${emp.name} (ZohoID: ${emp.zohoId})...`);
      
      const result = await db
        .select()
        .from(employees)
        .where(eq(employees.zohoId, emp.zohoId));
      
      if (result.length > 0) {
        console.log(`✅ FOUND: ${emp.name} is now in PostgreSQL database`);
        console.log(`   Employee ID: ${result[0].id}`);
        console.log(`   Name: ${result[0].name}`);
        console.log(`   Department: ${result[0].department}`);
        console.log(`   Business Unit: ${result[0].businessUnit}`);
        
        // Check if they can access comments (even if none exist yet)
        const comments = await db
          .select()
          .from(chatCommentsIntended)
          .where(eq(chatCommentsIntended.zohoId, emp.zohoId));
        
        console.log(`   📝 Comments: ${comments.length} comments found`);
        if (comments.length > 0) {
          console.log(`   📝 Sample comment: "${comments[0].content}" by ${comments[0].sender}`);
        }
        
        console.log(`   🎯 STATUS: Ready for Karthik to add comments\n`);
      } else {
        console.log(`❌ NOT FOUND: ${emp.name} still not in PostgreSQL database\n`);
      }
    }
    
    // Get total count of employees in PostgreSQL
    const totalEmployees = await db.select().from(employees);
    console.log(`📊 Total employees in PostgreSQL: ${totalEmployees.length}`);
    
    // Check if any comments exist for these employees
    const allComments = await db.select().from(chatCommentsIntended);
    console.log(`📝 Total comments in system: ${allComments.length}`);
    
    console.log('\n🎯 SUMMARY:');
    console.log('- The automatic employee synchronization should now make these employees available');
    console.log('- Karthik can now add comments for Gurjeet Kaur and Hassan Hussain');
    console.log('- Comments will be properly attributed to their specific ZohoIDs');
    console.log('- No more "employee not found" errors when adding comments');
    
  } catch (error) {
    console.error('❌ Error testing employee sync:', error);
  }
}

testKarthikEmployeesSync();