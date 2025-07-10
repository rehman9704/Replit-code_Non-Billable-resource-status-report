/**
 * Debug Message Count Display in Live Chat Column
 * Verifies that employees with comments show proper message count badges
 */

const { neon } = require('@neondatabase/serverless');

async function debugMessageCountDisplay() {
  try {
    console.log('🔍 Debugging message count display in Live Chat column...\n');
    
    if (!process.env.DATABASE_URL) {
      console.log('❌ DATABASE_URL not found');
      return;
    }

    const sql = neon(process.env.DATABASE_URL);
    
    // Get employees with comments from the intended comments table
    const employeesWithComments = await sql`
      SELECT DISTINCT 
        intended_zoho_id as zoho_id,
        intended_employee_name as employee_name,
        COUNT(*) as comment_count
      FROM chat_comments_intended 
      WHERE is_visible = true
      GROUP BY intended_zoho_id, intended_employee_name
      ORDER BY comment_count DESC
      LIMIT 10
    `;
    
    console.log('📊 EMPLOYEES WITH COMMENTS (should show message count badges):');
    console.log('='.repeat(70));
    
    for (const emp of employeesWithComments) {
      console.log(`✅ ${emp.employee_name} (ZohoID: ${emp.zoho_id})`);
      console.log(`   📝 Comments: ${emp.comment_count}`);
      console.log(`   🎯 Should show badge with count: ${emp.comment_count}`);
      console.log('');
    }
    
    // Check total visible comments
    const totalComments = await sql`
      SELECT COUNT(*) as total 
      FROM chat_comments_intended 
      WHERE is_visible = true
    `;
    
    console.log(`📈 TOTAL VISIBLE COMMENTS: ${totalComments[0].total}`);
    console.log(`📈 EMPLOYEES WITH COMMENTS: ${employeesWithComments.length}`);
    
    console.log('\n🎯 EXPECTED BEHAVIOR IN DASHBOARD:');
    console.log('- Employees listed above should show blue message icons with red count badges');
    console.log('- Employees without comments should show gray message icons with no badges');
    console.log('- ZohoID-based API ensures accurate message counts per employee');
    console.log('- Live Chat column should be fully functional for adding/viewing comments');
    
    // Test API endpoint for top employee
    if (employeesWithComments.length > 0) {
      const topEmployee = employeesWithComments[0];
      console.log(`\n🧪 TESTING API FOR TOP EMPLOYEE: ${topEmployee.employee_name}`);
      
      try {
        const response = await fetch(`http://localhost:5000/api/chat-messages/zoho/${topEmployee.zoho_id}`);
        if (response.ok) {
          const messages = await response.json();
          console.log(`✅ API Response: ${messages.length} messages returned`);
          console.log(`✅ Matches database count: ${messages.length === parseInt(topEmployee.comment_count)}`);
        } else {
          console.log(`❌ API Error: ${response.status}`);
        }
      } catch (apiError) {
        console.log(`❌ API Test failed: ${apiError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging message count display:', error);
  }
}

debugMessageCountDisplay();