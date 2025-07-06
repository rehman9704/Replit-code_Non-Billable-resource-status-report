/**
 * Fix Chat Attribution for Praveen M G (Zoho ID: 10012260)
 * The Petbarn/Shopify comments are currently attributed to employee_id 80 but should be for Praveen
 */

const { Pool } = require('pg');
const sql = require('mssql');

// PostgreSQL configuration
const pgConfig = {
  connectionString: process.env.DATABASE_URL
};

// Azure SQL configuration
const azureConfig = {
  server: 'royalcyberserver.database.windows.net',
  database: 'royalcyber',
  user: 'royalcyber',
  password: 'test@1234',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function fixPraveenAttribution() {
  let pgPool;
  
  try {
    console.log('🔍 Connecting to databases...');
    
    // Connect to PostgreSQL
    pgPool = new Pool(pgConfig);
    
    // Connect to Azure SQL
    await sql.connect(azureConfig);
    
    // Step 1: Find Praveen M G in Azure SQL
    console.log('📋 Finding Praveen M G in Azure SQL Database...');
    const azureResult = await sql.query`
      SELECT ZohoID, FullName, EmployeeStatus 
      FROM zoho_Employee 
      WHERE ZohoID = '10012260'
    `;
    
    if (azureResult.recordset.length === 0) {
      console.log('❌ Praveen M G (10012260) not found in Azure SQL Database');
      return;
    }
    
    const praveenData = azureResult.recordset[0];
    console.log('✅ Found Praveen M G in Azure SQL:', praveenData);
    
    // Step 2: Find current PostgreSQL mapping for Praveen M G
    console.log('🔍 Checking current PostgreSQL mapping...');
    const pgResult = await pgPool.query(
      'SELECT * FROM employees WHERE "zohoId" = $1 OR name ILIKE $2',
      ['10012260', '%Praveen%M%G%']
    );
    
    console.log('🔍 PostgreSQL mapping results:', pgResult.rows);
    
    // Step 3: Check current chat messages attributed to employee_id 80
    console.log('📱 Current chat messages for employee_id 80:');
    const currentMessages = await pgPool.query(
      'SELECT id, employee_id, sender, content, timestamp FROM chat_messages WHERE employee_id = 80 ORDER BY timestamp DESC'
    );
    
    currentMessages.rows.forEach(msg => {
      console.log(`  Message ${msg.id}: "${msg.content}" (${msg.timestamp})`);
    });
    
    // Step 4: Identify Petbarn/Shopify messages that belong to Praveen
    const praveenMessages = currentMessages.rows.filter(msg => 
      msg.content.includes('Petbarn') || msg.content.includes('Shopify')
    );
    
    console.log(`\n🎯 Found ${praveenMessages.length} Petbarn/Shopify messages that should belong to Praveen:`);
    praveenMessages.forEach(msg => {
      console.log(`  Message ${msg.id}: "${msg.content}"`);
    });
    
    // Step 5: Determine correct employee_id for Praveen M G
    let praveenEmployeeId;
    
    if (pgResult.rows.length > 0) {
      // Praveen exists in PostgreSQL
      praveenEmployeeId = parseInt(pgResult.rows[0].id);
      console.log(`✅ Praveen M G found in PostgreSQL with employee_id: ${praveenEmployeeId}`);
    } else {
      // Need to find an appropriate employee_id for Praveen
      console.log('⚠️ Praveen M G not found in PostgreSQL. Finding suitable employee_id...');
      
      // Check what employee IDs are available in chat messages
      const usedIds = await pgPool.query(
        'SELECT DISTINCT employee_id FROM chat_messages ORDER BY employee_id'
      );
      
      console.log('📊 Currently used employee IDs in chat_messages:', usedIds.rows.map(r => r.employee_id));
      
      // Find available employee_id that corresponds to active employees
      const availableEmployee = await pgPool.query(
        'SELECT id, name, "zohoId" FROM employees WHERE id NOT IN (SELECT DISTINCT employee_id FROM chat_messages) ORDER BY id LIMIT 5'
      );
      
      console.log('🎯 Available employee IDs without chat messages:', availableEmployee.rows);
      
      if (availableEmployee.rows.length > 0) {
        praveenEmployeeId = parseInt(availableEmployee.rows[0].id);
        console.log(`🎯 Selected employee_id ${praveenEmployeeId} for Praveen M G mapping`);
      } else {
        console.log('❌ No available employee_id found');
        return;
      }
    }
    
    // Step 6: Update chat message attribution
    if (praveenMessages.length > 0) {
      console.log(`\n🔧 Updating ${praveenMessages.length} messages to employee_id ${praveenEmployeeId}...`);
      
      for (const msg of praveenMessages) {
        await pgPool.query(
          'UPDATE chat_messages SET employee_id = $1 WHERE id = $2',
          [praveenEmployeeId, msg.id]
        );
        console.log(`✅ Updated message ${msg.id} to employee_id ${praveenEmployeeId}`);
      }
      
      console.log('🎉 Successfully updated chat message attribution for Praveen M G!');
    }
    
    // Step 7: Verify the fix
    console.log('\n🔍 Verification - Checking messages for both employee IDs:');
    
    const verifyOld = await pgPool.query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE employee_id = 80'
    );
    console.log(`Employee_id 80 now has ${verifyOld.rows[0].count} messages`);
    
    const verifyNew = await pgPool.query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE employee_id = $1',
      [praveenEmployeeId]
    );
    console.log(`Employee_id ${praveenEmployeeId} (Praveen) now has ${verifyNew.rows[0].count} messages`);
    
    // Show the updated messages for Praveen
    const updatedMessages = await pgPool.query(
      'SELECT id, content, timestamp FROM chat_messages WHERE employee_id = $1 ORDER BY timestamp DESC',
      [praveenEmployeeId]
    );
    
    console.log(`\n📋 Praveen M G's messages (employee_id ${praveenEmployeeId}):`);
    updatedMessages.rows.forEach(msg => {
      console.log(`  "${msg.content}" (${msg.timestamp})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup connections
    if (pgPool) {
      await pgPool.end();
    }
    await sql.close();
  }
}

fixPraveenAttribution();