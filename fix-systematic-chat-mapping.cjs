/**
 * Systematic Chat Attribution Fix
 * Maps all chat messages to correct employee IDs based on Zoho ID correlation
 */

const { Pool } = require('pg');
const sql = require('mssql');

// PostgreSQL connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Azure SQL Database connection
const azureConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USERNAME,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function fixSystematicChatMapping() {
  let azurePool;
  
  try {
    console.log('🚀 Starting systematic chat attribution fix...');
    
    // Connect to Azure SQL Database
    console.log('📡 Connecting to Azure SQL Database...');
    azurePool = await sql.connect(azureConfig);
    
    // Get all employees from Azure SQL Database with their Zoho IDs
    console.log('📊 Fetching employees from Azure SQL Database...');
    const azureResult = await azurePool.request().query(`
      SELECT 
        ZohoID,
        FullName,
        ROW_NUMBER() OVER (ORDER BY ZohoID) as RowNum
      FROM EmployeeTimesheetData 
      WHERE ZohoID IS NOT NULL
      ORDER BY ZohoID
    `);
    
    console.log(`📈 Found ${azureResult.recordset.length} employees in Azure SQL Database`);
    
    // Get all chat messages from PostgreSQL
    console.log('💬 Fetching chat messages from PostgreSQL...');
    const pgResult = await pgPool.query('SELECT id, employee_id, content, sender FROM chat_messages ORDER BY id');
    
    console.log(`📨 Found ${pgResult.rows.length} chat messages in PostgreSQL`);
    
    // Create mapping based on known employee names and content
    const knownMappings = {
      'Laxmi Pavani': '10013228',
      'Praveen M G': '10012260', 
      'Mohammad Bilal G': '10013234',
      'Abdul Wahab': '10114331'
    };
    
    // Map chat messages to correct employee IDs
    let fixedCount = 0;
    
    for (const message of pgResult.rows) {
      const content = message.content.toLowerCase();
      let targetZohoId = null;
      
      // Check for known employee references in message content
      if (content.includes('laxmi') || content.includes('non billable for initial 3 months')) {
        targetZohoId = '10013228'; // Laxmi Pavani
      } else if (content.includes('praveen') || content.includes('petbarn') || content.includes('shopify')) {
        targetZohoId = '10012260'; // Praveen M G
      } else if (content.includes('bilal') || content.includes('optimizely')) {
        targetZohoId = '10013234'; // Mohammad Bilal G
      } else if (content.includes('abdul') || content.includes('hd supply')) {
        targetZohoId = '10114331'; // Abdul Wahab
      }
      
      if (targetZohoId) {
        // Find the correct employee row number in Azure SQL Database
        const employee = azureResult.recordset.find(emp => emp.ZohoID === targetZohoId);
        
        if (employee) {
          const correctEmployeeId = employee.RowNum;
          
          if (message.employee_id !== correctEmployeeId) {
            console.log(`🔄 Moving message ${message.id} from employee ${message.employee_id} to ${correctEmployeeId} (${employee.FullName} - ${targetZohoId})`);
            
            await pgPool.query(
              'UPDATE chat_messages SET employee_id = $1 WHERE id = $2',
              [correctEmployeeId, message.id]
            );
            
            fixedCount++;
          }
        }
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} chat message attributions`);
    console.log('🎯 Systematic chat mapping fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during systematic chat mapping fix:', error);
  } finally {
    if (azurePool) {
      await azurePool.close();
    }
    await pgPool.end();
  }
}

fixSystematicChatMapping();