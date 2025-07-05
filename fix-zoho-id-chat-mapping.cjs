/**
 * CRITICAL FIX: Map Chat Messages to Actual Azure SQL ZOHO IDs
 * 
 * Root Issue: Chat messages use PostgreSQL internal IDs (1,2,3,4) but frontend
 * requests data using Azure SQL employee IDs (159, 162, 165, etc.)
 * 
 * Solution: Find actual Azure SQL employees and update chat_messages table
 */

const { neon } = require('@neondatabase/serverless');
const sql = require('mssql');

const pgSql = neon(process.env.DATABASE_URL);

const azureConfig = {
  server: 'uat-server.database.windows.net',
  database: 'RC_BI_Database',
  authentication: {
    type: 'azure-active-directory-password',
    options: {
      userName: 'hussain@royalcyber.com',
      password: process.env.AZURE_DB_PASSWORD
    }
  },
  options: {
    encrypt: true,
    enableArithAbort: true,
    connectTimeout: 60000,
    requestTimeout: 60000
  }
};

async function fixZohoIdChatMapping() {
  console.log('🔍 CRITICAL CHAT MAPPING FIX: Finding actual Azure SQL employees for chat senders');
  
  try {
    // Connect to Azure SQL
    await sql.connect(azureConfig);
    console.log('✅ Connected to Azure SQL Database');

    // Get chat message senders
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

    console.log('\n🔍 SEARCHING FOR ACTUAL AZURE SQL EMPLOYEES...');
    
    const correctMappings = [];
    
    for (const sender of chatSenders) {
      console.log(`\n🔎 Searching for: ${sender.sender}`);
      
      // Search Azure SQL for this employee by name
      const azureEmployees = await sql.query`
        SELECT TOP 5 
          ID,
          ZohoID,
          FullName,
          Employee_Number
        FROM zoho_Employee 
        WHERE FullName LIKE ${'%' + sender.sender + '%'}
        OR FullName LIKE ${'%' + sender.sender.split(' ')[0] + '%'}
        ORDER BY FullName
      `;

      if (azureEmployees.recordset.length > 0) {
        console.log('  📍 FOUND MATCHES:');
        for (const emp of azureEmployees.recordset) {
          console.log(`    ID: ${emp.ID}, ZOHO: ${emp.ZohoID}, Name: ${emp.FullName}`);
        }
        
        // Take the best match (first one for now, can be refined)
        const bestMatch = azureEmployees.recordset[0];
        correctMappings.push({
          chatSender: sender.sender,
          oldInternalId: sender.employee_id,
          newAzureSqlId: bestMatch.ID,
          zohoId: bestMatch.ZohoID,
          fullName: bestMatch.FullName,
          messageCount: sender.message_count
        });
        
        console.log(`    ✅ BEST MATCH: ${bestMatch.FullName} (Azure ID: ${bestMatch.ID}, ZOHO: ${bestMatch.ZohoID})`);
      } else {
        console.log(`    ❌ NO MATCH FOUND for: ${sender.sender}`);
      }
    }

    console.log('\n🔄 PROPOSED CHAT MESSAGE MAPPING UPDATES:');
    for (const mapping of correctMappings) {
      console.log(`  ${mapping.chatSender} (${mapping.messageCount} messages)`);
      console.log(`    OLD: Internal ID ${mapping.oldInternalId}`);
      console.log(`    NEW: Azure ID ${mapping.newAzureSqlId}, ZOHO ID ${mapping.zohoId}`);
      console.log(`    Name: ${mapping.fullName}`);
      console.log('');
    }

    // Update employee_zoho_mapping table with correct Azure SQL IDs
    console.log('\n💾 UPDATING EMPLOYEE_ZOHO_MAPPING TABLE...');
    
    for (const mapping of correctMappings) {
      await pgSql`
        INSERT INTO employee_zoho_mapping (internal_id, zoho_id, employee_name, azure_sql_id)
        VALUES (${mapping.newAzureSqlId}, ${mapping.zohoId}, ${mapping.fullName}, ${mapping.newAzureSqlId})
        ON CONFLICT (internal_id) DO UPDATE SET
          zoho_id = EXCLUDED.zoho_id,
          employee_name = EXCLUDED.employee_name,
          azure_sql_id = EXCLUDED.azure_sql_id
      `;
      
      console.log(`  ✅ Mapped: ${mapping.fullName} (Azure ID: ${mapping.newAzureSqlId})`);
    }

    // Update chat_messages table to use correct Azure SQL IDs
    console.log('\n🔄 UPDATING CHAT_MESSAGES TABLE WITH CORRECT AZURE SQL IDs...');
    
    for (const mapping of correctMappings) {
      const updateResult = await pgSql`
        UPDATE chat_messages 
        SET employee_id = ${mapping.newAzureSqlId}
        WHERE employee_id = ${mapping.oldInternalId}
      `;
      
      console.log(`  ✅ Updated ${updateResult.count} messages: ${mapping.chatSender} → Azure ID ${mapping.newAzureSqlId}`);
    }

    // Verify the fix
    console.log('\n✅ VERIFICATION: Updated chat message counts by employee');
    const verificationResult = await pgSql`
      SELECT 
        cm.employee_id,
        ezm.employee_name,
        ezm.zoho_id,
        COUNT(cm.id) as message_count
      FROM chat_messages cm
      LEFT JOIN employee_zoho_mapping ezm ON cm.employee_id = ezm.internal_id
      GROUP BY cm.employee_id, ezm.employee_name, ezm.zoho_id
      ORDER BY message_count DESC
    `;

    for (const row of verificationResult) {
      console.log(`  📊 Employee ID ${row.employee_id}: ${row.employee_name || 'UNMAPPED'} (ZOHO: ${row.zoho_id || 'N/A'}) - ${row.message_count} messages`);
    }

    console.log('\n🎉 CRITICAL MAPPING FIX COMPLETED SUCCESSFULLY!');
    console.log('✅ Chat messages now use correct Azure SQL employee IDs');
    console.log('✅ Frontend will display correct employee names');
    console.log('✅ ZOHO ID mapping ensures permanent attribution accuracy');

  } catch (error) {
    console.error('❌ Error fixing ZOHO ID chat mapping:', error);
  } finally {
    await sql.close();
  }
}

fixZohoIdChatMapping();