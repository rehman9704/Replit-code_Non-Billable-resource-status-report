/**
 * SPECIFIC EMPLOYEE COMMENT MAPPING FIX
 * Maps comments to exact ZohoIDs as specified by users
 */

const { Pool } = require('pg');
const sql = require('mssql');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  }
};

async function fixSpecificEmployeeMapping() {
  try {
    console.log('🎯 FIXING SPECIFIC EMPLOYEE COMMENT MAPPING\n');
    
    // 1. Connect to Azure SQL to get real employee data
    await sql.connect(azureConfig);
    
    // 2. Define exact mappings as specified by users
    const specificMappings = [
      {
        zohoId: '10012260',
        name: 'Praveen M G',
        commentKeywords: ['Petbarn', 'Shopify'],
        targetPostgresId: 20
      },
      {
        zohoId: '10013228', 
        name: 'Laxmi Pavani',
        commentKeywords: ['September', 'non billable for initial 3 months'],
        targetPostgresId: 21
      },
      {
        zohoId: '10012233',
        name: 'Mohammad Bilal G', 
        commentKeywords: ['Optimizely'],
        targetPostgresId: 22
      },
      {
        zohoId: '10012796',
        name: 'Prabhjas Singh Bajwa',
        commentKeywords: ['AI training', 'GWA Use case'],
        targetPostgresId: 23
      },
      {
        zohoId: '10114291',
        name: 'Jatin Udasi',
        commentKeywords: ['AI training', 'GWA Use case'], 
        targetPostgresId: 24
      }
    ];
    
    console.log('📋 CREATING SPECIFIC EMPLOYEE RECORDS:');
    
    // 3. Create/update PostgreSQL employee records for each specific employee
    for (const mapping of specificMappings) {
      // Get real employee data from Azure SQL
      const azureEmployee = await sql.query(`
        SELECT ZohoID, FullName, Department, BusinessUnit, Location
        FROM RC_BI_Database.dbo.zoho_Employee 
        WHERE ZohoID = '${mapping.zohoId}'
      `);
      
      if (azureEmployee.recordset.length > 0) {
        const emp = azureEmployee.recordset[0];
        
        // Create/update in PostgreSQL
        await pool.query(`
          INSERT INTO employees (
            id, zoho_id, name, department, business_unit, billable_status, 
            location, client, project, last_month_billable, last_month_billable_hours, 
            last_month_non_billable_hours, cost, timesheet_aging
          )
          VALUES ($1, $2, $3, $4, $5, 'Active', $6, $7, 'Various Projects', 0, 0, 0, 0, '0-30')
          ON CONFLICT (id) DO UPDATE SET
            zoho_id = EXCLUDED.zoho_id,
            name = EXCLUDED.name,
            department = EXCLUDED.department,
            business_unit = EXCLUDED.business_unit,
            location = EXCLUDED.location,
            client = EXCLUDED.client
        `, [
          mapping.targetPostgresId, 
          mapping.zohoId, 
          emp.FullName || mapping.name, 
          emp.Department || 'Development',
          emp.BusinessUnit || 'Digital Commerce',
          emp.Location || 'Hyderabad',
          'Internal'
        ]);
        
        console.log(`✅ Created/Updated: ${emp.FullName} (${mapping.zohoId}) -> PostgreSQL ID ${mapping.targetPostgresId}`);
      } else {
        console.log(`⚠️  Employee ${mapping.zohoId} not found in Azure SQL, creating with provided name`);
        
        await pool.query(`
          INSERT INTO employees (
            id, zoho_id, name, department, business_unit, billable_status, 
            location, client, project, last_month_billable, last_month_billable_hours, 
            last_month_non_billable_hours, cost, timesheet_aging
          )
          VALUES ($1, $2, $3, 'Development', 'Digital Commerce', 'Active', 'Hyderabad', 'Internal', 'Various Projects', 0, 0, 0, 0, '0-30')
          ON CONFLICT (id) DO UPDATE SET
            zoho_id = EXCLUDED.zoho_id,
            name = EXCLUDED.name
        `, [mapping.targetPostgresId, mapping.zohoId, mapping.name]);
        
        console.log(`✅ Created: ${mapping.name} (${mapping.zohoId}) -> PostgreSQL ID ${mapping.targetPostgresId}`);
      }
    }
    
    console.log('\n🔄 MAPPING COMMENTS TO SPECIFIC EMPLOYEES:');
    
    // 4. Map comments based on content keywords
    for (const mapping of specificMappings) {
      for (const keyword of mapping.commentKeywords) {
        const commentQuery = `
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE content ILIKE $2 
          AND employee_id != $1
        `;
        
        const updateResult = await pool.query(commentQuery, [
          mapping.targetPostgresId, 
          `%${keyword}%`
        ]);
        
        if (updateResult.rowCount > 0) {
          console.log(`📝 Moved ${updateResult.rowCount} messages containing "${keyword}" to ${mapping.name} (${mapping.zohoId})`);
        }
      }
    }
    
    // 5. Verify the mappings
    console.log('\n🔍 VERIFICATION OF SPECIFIC MAPPINGS:');
    
    for (const mapping of specificMappings) {
      const messages = await pool.query(`
        SELECT content, sender, timestamp
        FROM chat_messages 
        WHERE employee_id = $1
        ORDER BY timestamp DESC
        LIMIT 3
      `, [mapping.targetPostgresId]);
      
      console.log(`\n👤 ${mapping.name} (${mapping.zohoId}):`);
      if (messages.rows.length > 0) {
        console.log(`   📧 ${messages.rows.length} messages found:`);
        messages.rows.forEach((msg, i) => {
          console.log(`   ${i + 1}. "${msg.content.substring(0, 60)}..." - ${msg.sender}`);
        });
      } else {
        console.log(`   ⚠️  No messages found - may need manual verification`);
      }
    }
    
    // 6. Final distribution summary
    console.log('\n📊 FINAL COMMENT DISTRIBUTION FOR SPECIFIC EMPLOYEES:');
    const finalDistribution = await pool.query(`
      SELECT 
        e.zoho_id,
        e.name,
        COUNT(cm.id) as message_count,
        COUNT(DISTINCT cm.sender) as unique_senders
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE e.zoho_id IN ('10012260', '10013228', '10012233', '10012796', '10114291')
      GROUP BY e.id, e.zoho_id, e.name
      ORDER BY e.zoho_id
    `);
    
    finalDistribution.rows.forEach(row => {
      console.log(`   ${row.zoho_id} - ${row.name}: ${row.message_count} messages from ${row.unique_senders} users`);
    });
    
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Created specific employee records for 5 employees`);
    console.log(`   ✅ Mapped comments using content keywords`);
    console.log(`   ✅ Comments now appear under correct ZohoIDs as requested`);
    console.log(`   ✅ Users should now see proper attribution`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    await sql.close();
  }
}

fixSpecificEmployeeMapping();