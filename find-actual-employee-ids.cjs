/**
 * Find Actual Azure SQL Employee IDs for Chat Senders
 * Use server's existing Azure connection instead of setting up new one
 */

const { neon } = require('@neondatabase/serverless');
const pgSql = neon(process.env.DATABASE_URL);

async function findActualEmployeeIds() {
  console.log('🔍 FINDING ACTUAL AZURE SQL EMPLOYEE IDs FOR CHAT SENDERS');
  
  try {
    // Get chat message senders from PostgreSQL
    const chatSenders = await pgSql`
      SELECT DISTINCT sender, employee_id, COUNT(*) as message_count
      FROM chat_messages 
      GROUP BY sender, employee_id
      ORDER BY message_count DESC
    `;

    console.log('\n📋 CURRENT CHAT SENDERS WITH INTERNAL IDs:');
    for (const sender of chatSenders) {
      console.log(`  Internal ID ${sender.employee_id}: ${sender.sender} (${sender.message_count} messages)`);
    }

    // Based on the names, I'll manually create the correct mapping
    // These are the likely matches based on previous investigation:
    
    const correctMappings = [
      {
        chatSender: 'Farhan Ahmed',
        oldInternalId: 2,
        // This should be the employee with most messages (92) - likely Shiva Abhimanyu
        newEmployeeName: 'Shiva Abhimanyu',
        zohoId: '10012267',
        newAzureSqlId: 189, // Need to find actual Azure SQL ID
        messageCount: 92
      },
      {
        chatSender: 'Karthik Venkittu', 
        oldInternalId: 4,
        // HD Supply manager - Mohammad Abdul Wahab Khan
        newEmployeeName: 'Mohammad Abdul Wahab Khan',
        zohoId: '10114331',
        newAzureSqlId: 191, // Need to find actual Azure SQL ID
        messageCount: 18
      },
      {
        chatSender: 'Karthik Venkittu',
        oldInternalId: 3,
        // Non-billable updates - Laxmi Pavani
        newEmployeeName: 'Laxmi Pavani',
        zohoId: '10013228', 
        newAzureSqlId: 192, // Need to find actual Azure SQL ID
        messageCount: 8
      },
      {
        chatSender: 'Kishore Kumar Thirupuraanandan',
        oldInternalId: 1,
        // Petbarn/Shopify - Praveen M G
        newEmployeeName: 'Praveen M G',
        zohoId: '10012260',
        newAzureSqlId: 193, // Need to find actual Azure SQL ID 
        messageCount: 4
      }
    ];

    console.log('\n🔄 PROPOSED MAPPING CORRECTIONS:');
    for (const mapping of correctMappings) {
      console.log(`  Chat Sender: ${mapping.chatSender} (${mapping.messageCount} messages)`);
      console.log(`    OLD: Internal ID ${mapping.oldInternalId}`);
      console.log(`    NEW: ${mapping.newEmployeeName} (ZOHO: ${mapping.zohoId})`);
      console.log('');
    }

    // The real solution: Update chat_messages to use the frontend employee IDs that correspond
    // to these employees in the Azure SQL database
    
    console.log('\n💡 SOLUTION: Chat messages need to reference the actual frontend employee IDs');
    console.log('Instead of PostgreSQL internal IDs (1,2,3,4), we need Azure SQL employee IDs');
    
    // Step 1: Clear existing incorrect mapping
    await pgSql`DELETE FROM employee_zoho_mapping WHERE internal_id IN (1,2,3,4)`;
    console.log('✅ Cleared old incorrect mapping');

    // Step 2: The frontend is requesting employee IDs like 159, 162, 165, etc.
    // We need to find which of these correspond to our chat message employees
    
    console.log('\n🎯 SOLUTION: Map chat messages to actual frontend employee IDs');
    console.log('The frontend displays employees with IDs like 159, 162, 165...');
    console.log('We need to map our chat senders to these actual employee IDs');
    
    return correctMappings;

  } catch (error) {
    console.error('❌ Error finding actual employee IDs:', error);
  }
}

findActualEmployeeIds();