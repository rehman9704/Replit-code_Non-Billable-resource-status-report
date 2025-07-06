/**
 * DIRECT EMPLOYEE COMMENT MAPPING FIX
 * Maps comments to exact employees as specified by users using their existing IDs
 */

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixDirectEmployeeMapping() {
  try {
    console.log('🎯 DIRECT EMPLOYEE COMMENT MAPPING FIX\n');
    
    // 1. Check current employee mapping
    const existingEmployees = await pool.query(`
      SELECT id, zoho_id, name FROM employees 
      WHERE zoho_id IN ('10012260', '10013228', '10012233', '10012796', '10114291')
      ORDER BY zoho_id
    `);
    
    console.log('📋 EXISTING EMPLOYEES:');
    existingEmployees.rows.forEach(emp => {
      console.log(`   ID ${emp.id}: ${emp.name} (${emp.zoho_id})`);
    });
    
    // 2. Create missing employees
    const missingEmployees = [
      { id: 25, zohoId: '10012233', name: 'Mohammad Bilal G' },
      { id: 26, zohoId: '10012796', name: 'Prabhjas Singh Bajwa' }, 
      { id: 27, zohoId: '10114291', name: 'Jatin Udasi' }
    ];
    
    console.log('\n📋 CREATING MISSING EMPLOYEES:');
    for (const emp of missingEmployees) {
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
      `, [emp.id, emp.zohoId, emp.name]);
      
      console.log(`   ✅ Created: ${emp.name} (${emp.zohoId}) -> ID ${emp.id}`);
    }
    
    // 3. Define comment mapping based on content
    const commentMappings = [
      {
        employeeId: 80, // Existing Praveen M G (10012260)
        keywords: ['Petbarn', 'Shopify'],
        name: 'Praveen M G',
        zohoId: '10012260'
      },
      {
        employeeId: 7, // Existing Laxmi Pavani (10013228)
        keywords: ['September', 'non billable for initial 3 months'],
        name: 'Laxmi Pavani', 
        zohoId: '10013228'
      },
      {
        employeeId: 25, // New Mohammad Bilal G (10012233)
        keywords: ['Optimizely'],
        name: 'Mohammad Bilal G',
        zohoId: '10012233'
      },
      {
        employeeId: 26, // New Prabhjas Singh Bajwa (10012796)
        keywords: ['AI training', 'GWA Use case', 'Prabhjas'],
        name: 'Prabhjas Singh Bajwa',
        zohoId: '10012796'
      },
      {
        employeeId: 27, // New Jatin Udasi (10114291)
        keywords: ['Jatin', 'AI training'],
        name: 'Jatin Udasi',
        zohoId: '10114291'
      }
    ];
    
    console.log('\n🔄 MAPPING COMMENTS TO CORRECT EMPLOYEES:');
    
    // 4. Move comments based on keywords
    for (const mapping of commentMappings) {
      for (const keyword of mapping.keywords) {
        const updateResult = await pool.query(`
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE content ILIKE $2 
          AND employee_id != $1
        `, [mapping.employeeId, `%${keyword}%`]);
        
        if (updateResult.rowCount > 0) {
          console.log(`   📝 Moved ${updateResult.rowCount} messages containing "${keyword}" to ${mapping.name} (${mapping.zohoId})`);
        }
      }
    }
    
    // 5. Specific content mapping for exact matches
    const specificMappings = [
      {
        content: 'Currently partially billable on the Petbarn project and undergoing training in Shopify',
        employeeId: 80,
        name: 'Praveen M G'
      },
      {
        content: 'She will non billable for initial 3 months - Expecting billable from September',
        employeeId: 7,
        name: 'Laxmi Pavani'
      },
      {
        content: 'There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely',
        employeeId: 25,
        name: 'Mohammad Bilal G'
      }
    ];
    
    console.log('\n🔍 MAPPING SPECIFIC EXACT CONTENT:');
    for (const mapping of specificMappings) {
      const updateResult = await pool.query(`
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE content LIKE $2
        AND employee_id != $1
      `, [mapping.employeeId, `%${mapping.content}%`]);
      
      if (updateResult.rowCount > 0) {
        console.log(`   ✅ Moved exact match to ${mapping.name}: "${mapping.content}"`);
      }
    }
    
    // 6. Verify the mappings
    console.log('\n🔍 VERIFICATION OF MAPPINGS:');
    
    for (const mapping of commentMappings) {
      const messages = await pool.query(`
        SELECT content, sender, timestamp
        FROM chat_messages 
        WHERE employee_id = $1
        ORDER BY timestamp DESC
        LIMIT 2
      `, [mapping.employeeId]);
      
      console.log(`\n👤 ${mapping.name} (${mapping.zohoId}) - ID ${mapping.employeeId}:`);
      if (messages.rows.length > 0) {
        console.log(`   📧 ${messages.rows.length} messages found:`);
        messages.rows.forEach((msg, i) => {
          console.log(`   ${i + 1}. "${msg.content.substring(0, 70)}..." - ${msg.sender}`);
        });
      } else {
        console.log(`   ⚠️  No messages found`);
      }
    }
    
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Created missing employee records for Mohammad Bilal G, Prabhjas Singh Bajwa, Jatin Udasi`);
    console.log(`   ✅ Used existing employees for Praveen M G (ID 80) and Laxmi Pavani (ID 7)`);
    console.log(`   ✅ Mapped comments using content keywords and exact matches`);
    console.log(`   ✅ Users should now see comments under correct ZohoIDs`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixDirectEmployeeMapping();