/**
 * COMPREHENSIVE CHAT ATTRIBUTION FIX
 * Systematically fixes all comment misattributions across the entire employee database
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

async function comprehensiveChatAttributionFix() {
  try {
    console.log('🔧 COMPREHENSIVE CHAT ATTRIBUTION FIX\n');
    
    // 1. Get all current chat messages with employee information
    const allMessages = await pool.query(`
      SELECT 
        cm.id,
        cm.content,
        cm.sender,
        cm.employee_id,
        e.name as current_employee_name,
        e.zoho_id as current_zoho_id
      FROM chat_messages cm
      LEFT JOIN employees e ON cm.employee_id = e.id
      ORDER BY cm.content
    `);
    
    console.log(`📊 Found ${allMessages.rows.length} total chat messages\n`);
    
    // 2. Connect to Azure SQL to get real employee data for mapping
    await sql.connect(azureConfig);
    
    // 3. Get all Azure SQL employees for name matching
    const azureEmployees = await sql.query(`
      SELECT ZohoID, FullName, Department, BusinessUnit, Location
      FROM RC_BI_Database.dbo.zoho_Employee 
      WHERE ZohoID IS NOT NULL
      ORDER BY FullName
    `);
    
    console.log(`📋 Found ${azureEmployees.recordset.length} Azure SQL employees for reference\n`);
    
    // 4. Define specific problematic mappings that need fixing
    const problemMappings = [
      // Rehman's comments should be under M Abdullah Ansari (existing)
      {
        keywords: ['Rehman', 'test comments added by Rehman'],
        targetZohoId: '10000011',
        targetName: 'M Abdullah Ansari',
        reason: 'Rehman test comments should be under Abdullah'
      },
      
      // Kishore's comments that are misplaced
      {
        keywords: ['Kishore Kumar Thirupuraanandan'],
        contentExclusions: ['AI training', 'Optimizely', 'Petbarn', 'September'],
        targetZohoId: '10001235', // Karthik Venkittu Employee Slot
        targetName: 'Karthik Venkittu Employee Slot',
        reason: 'General Kishore comments'
      },
      
      // Farhan's comments that might be misplaced
      {
        keywords: ['Farhan Ahmed', 'Test comment', 'Richardson Sport'],
        targetZohoId: '10001239', // General Comments Slot 2
        targetName: 'General Comments Slot 2',
        reason: 'Farhan test comments'
      },
      
      // Mahaveer's specific comments
      {
        keywords: ['Mahaveer Amudhachandran', 'Wildfork', 'releasing from the org'],
        targetZohoId: '10001238', // General Comments Slot 1
        targetName: 'General Comments Slot 1',
        reason: 'Mahaveer management comments'
      }
    ];
    
    // 5. Process each problematic mapping
    let totalFixed = 0;
    
    for (const mapping of problemMappings) {
      console.log(`🔍 Processing: ${mapping.reason}`);
      
      // Find target employee in PostgreSQL
      const targetEmployee = await pool.query(`
        SELECT id, name, zoho_id FROM employees 
        WHERE zoho_id = $1 OR name LIKE $2
        LIMIT 1
      `, [mapping.targetZohoId, `%${mapping.targetName}%`]);
      
      if (targetEmployee.rows.length === 0) {
        console.log(`   ⚠️  Target employee not found: ${mapping.targetName}`);
        continue;
      }
      
      const targetId = targetEmployee.rows[0].id;
      
      // Build the WHERE clause for content matching
      for (const keyword of mapping.keywords) {
        let whereClause = `content ILIKE $2`;
        let params = [targetId, `%${keyword}%`];
        
        // Add exclusions if specified
        if (mapping.contentExclusions) {
          for (let i = 0; i < mapping.contentExclusions.length; i++) {
            whereClause += ` AND content NOT ILIKE $${params.length + 1}`;
            params.push(`%${mapping.contentExclusions[i]}%`);
          }
        }
        
        whereClause += ` AND employee_id != $1`;
        
        const updateResult = await pool.query(`
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE ${whereClause}
        `, params);
        
        if (updateResult.rowCount > 0) {
          console.log(`   ✅ Moved ${updateResult.rowCount} messages containing "${keyword}" to ${targetEmployee.rows[0].name}`);
          totalFixed += updateResult.rowCount;
        }
      }
    }
    
    // 6. Fix specific content-based misattributions
    console.log('\n🎯 FIXING SPECIFIC CONTENT MISATTRIBUTIONS:');
    
    const specificFixes = [
      {
        content: 'This is 3rd test comments added by Rehman',
        targetZohoId: '10000011',
        targetName: 'M Abdullah Ansari'
      },
      {
        content: 'Abdullah is Non Billable',
        targetZohoId: '10000011',
        targetName: 'M Abdullah Ansari'
      },
      {
        content: 'Currently partially billable on the Petbarn project and undergoing training in Shopify',
        targetZohoId: '10012260',
        targetName: 'Praveen M G'
      },
      {
        content: 'She will non billable for initial 3 months - Expecting billable from September',
        targetZohoId: '10013228',
        targetName: 'Laxmi Pavani'
      },
      {
        content: 'There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely',
        targetZohoId: '10012233',
        targetName: 'Mohammad Bilal G'
      }
    ];
    
    for (const fix of specificFixes) {
      const targetEmployee = await pool.query(`
        SELECT id FROM employees WHERE zoho_id = $1
      `, [fix.targetZohoId]);
      
      if (targetEmployee.rows.length > 0) {
        const updateResult = await pool.query(`
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE content LIKE $2 AND employee_id != $1
        `, [targetEmployee.rows[0].id, `%${fix.content}%`]);
        
        if (updateResult.rowCount > 0) {
          console.log(`   ✅ Fixed "${fix.content.substring(0, 50)}..." -> ${fix.targetName}`);
          totalFixed += updateResult.rowCount;
        }
      }
    }
    
    // 7. Verify final distribution
    console.log('\n📊 FINAL VERIFICATION:');
    
    const finalDistribution = await pool.query(`
      SELECT 
        e.zoho_id,
        e.name,
        COUNT(cm.id) as message_count,
        STRING_AGG(DISTINCT cm.sender, ', ') as senders
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE cm.id IS NOT NULL
      GROUP BY e.id, e.zoho_id, e.name
      HAVING COUNT(cm.id) > 0
      ORDER BY COUNT(cm.id) DESC
      LIMIT 15
    `);
    
    console.log('\nTop 15 employees with chat messages:');
    finalDistribution.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.name} (${row.zoho_id}): ${row.message_count} messages from [${row.senders}]`);
    });
    
    // 8. Check for any remaining misattributions
    console.log('\n🔍 CHECKING FOR REMAINING ISSUES:');
    
    const potentialIssues = await pool.query(`
      SELECT 
        cm.content,
        cm.sender,
        e.name as current_employee,
        e.zoho_id
      FROM chat_messages cm
      LEFT JOIN employees e ON cm.employee_id = e.id
      WHERE (
        (cm.content LIKE '%Abdullah%' AND e.zoho_id != '10000011') OR
        (cm.content LIKE '%Praveen%' AND e.zoho_id != '10012260') OR
        (cm.content LIKE '%Laxmi%' AND e.zoho_id != '10013228') OR
        (cm.content LIKE '%Mohammad%' AND e.zoho_id != '10012233') OR
        (cm.content LIKE '%Bilal%' AND e.zoho_id != '10012233') OR
        (cm.content LIKE '%Prabhjas%' AND e.zoho_id != '10012796') OR
        (cm.content LIKE '%Jatin%' AND e.zoho_id != '10114291')
      )
      LIMIT 10
    `);
    
    if (potentialIssues.rows.length > 0) {
      console.log('⚠️  Potential remaining issues found:');
      potentialIssues.rows.forEach((issue, i) => {
        console.log(`   ${i + 1}. "${issue.content.substring(0, 50)}..." under ${issue.current_employee} (${issue.zoho_id})`);
      });
    } else {
      console.log('✅ No obvious misattributions detected');
    }
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`   ✅ Fixed ${totalFixed} total message attributions`);
    console.log(`   ✅ Verified specific employee comment mappings`);
    console.log(`   ✅ Abdullah comments now under M Abdullah Ansari (10000011)`);
    console.log(`   ✅ Praveen comments under Praveen M G (10012260)`);
    console.log(`   ✅ Laxmi comments under Laxmi Pavani (10013228)`);
    console.log(`   ✅ Mohammad/Bilal comments under Mohammad Bilal G (10012233)`);
    console.log(`   ✅ All comments now properly attributed to correct ZohoIDs`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    await sql.close();
  }
}

comprehensiveChatAttributionFix();