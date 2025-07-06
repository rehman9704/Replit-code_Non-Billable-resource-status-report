/**
 * Restore Original Chat Attribution for Specific Employees
 * Reverts redistribution and maps comments back to their originally intended employees by ZohoID
 * Comments will only show when the specific employee exists in the system
 */

const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Original intended employee-comment mappings (comments should stay with these specific ZohoIDs)
const originalIntendedMapping = [
  {
    zohoId: '10012260',
    employeeName: 'Praveen M G',
    comment: 'Currently partially billable on the Petbarn project and undergoing training in Shopify'
  },
  {
    zohoId: '10013228', 
    employeeName: 'Laxmi Pavani',
    comment: 'She will non billable for initial 3 months - Expecting billable from September'
  },
  {
    zohoId: '10012233',
    employeeName: 'Mohammad Bilal G', 
    comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely'
  },
  {
    zohoId: '10012796',
    employeeName: 'Prabhjas Singh Bajwa',
    comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case'
  },
  {
    zohoId: '10114291',
    employeeName: 'Jatin Udasi', 
    comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case'
  },
  {
    zohoId: '10000391',
    employeeName: 'Prashanth Janardhanan',
    comment: 'Billable under  JE Dune , Richarson'
  },
  // Comments for employees not currently in system - create placeholder records
  {
    zohoId: '10012956',
    employeeName: 'Monika Pal',
    comment: '50% Billable in Whilecap . Aslo PM for - Rockwest, UFA'
  },
  {
    zohoId: '10013105', 
    employeeName: 'Syamala Haritha Kolisetty',
    comment: 'Managing - Work Wear, Gallagher, Pet Barn'
  },
  {
    zohoId: '10013230',
    employeeName: 'Riya Saha',
    comment: 'Managing - PlaceMaker & Pet Barn ( AREN) - Cost covered in the Margin'
  },
  {
    zohoId: '10013366',
    employeeName: 'Nitin Jyotishi',
    comment: 'Managing - Barns and Noble, CEGB, JSW -  Will be billable 100% in MOS from JULY'
  },
  {
    zohoId: '10013668',
    employeeName: 'Bushra Jahangir',
    comment: 'Managing - Mena bev, JBS - Like a account manager for Pakistan base- Covered under Mena bev'
  },
  {
    zohoId: '10013776',
    employeeName: 'Khizar Touqeer',
    comment: 'Managing - Arcelik, Dollance , Arceli Hitachi - Cost Covered in the Margin'
  },
  {
    zohoId: '10114434',
    employeeName: 'Muhammad Aashir',
    comment: 'PM for Y design & True religion, From Aug Bellacor - 50 % billable - SOW is under preparation'
  },
  {
    zohoId: '10011067',
    employeeName: 'Bashir Uddin',
    comment: 'He is working in maintance - From 3rd July he will be billable'
  },
  {
    zohoId: '10012021',
    employeeName: 'Nova J',
    comment: 'Placemaker Buffer - Will be 100% billable from Mid July'
  },
  {
    zohoId: '10012577',
    employeeName: 'Shruti Agarwal',
    comment: 'Training on SAP S4 Hana -  Back up  Bench - Less cost'
  },
  {
    zohoId: '10012580',
    employeeName: 'Masood Tariq',
    comment: 'Training on SAP S4 Hana -  Back up  Bench - Less cost'
  },
  {
    zohoId: '10010506',
    employeeName: 'Ashish Garg',
    comment: 'Keico (projection) -  (two and half month\'s bench)'
  },
  {
    zohoId: '10010603',
    employeeName: 'Hemant Kumar Gabra',
    comment: 'one and only React bench resource. (Plan for Training)'
  },
  {
    zohoId: '10010824',
    employeeName: 'Muhammad Awais',
    comment: 'JE Dunn Maintenance & Support - Bench from 10th June'
  },
  {
    zohoId: '10011131',
    employeeName: 'Saad Jamil Sandhu',
    comment: 'Dimond Roofing + KO Requirements Phase 1.Fletcher Builder - From 16th June on bench'
  },
  {
    zohoId: '10011980',
    employeeName: 'Farrukh Khan',
    comment: '8/10 Skill set -  good feedback'
  },
  {
    zohoId: '10012529',
    employeeName: 'Ghazala Bibi',
    comment: 'RAC - ACIMA Extended Aisle - Bench from 1st June'
  },
  {
    zohoId: '10012856',
    employeeName: 'Abilash Cherian',
    comment: 'Will be released from RAC by End of June.'
  },
  {
    zohoId: '10012238',
    employeeName: 'Muhammad Usman',
    comment: 'Shadow resource as per the SOW - Agreed and approved by Finance'
  }
];

async function restoreOriginalChatAttribution() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Restoring Original Chat Attribution for Specific Employees...');
    
    // Step 1: Get current employees in the system
    const employeeQuery = `
      SELECT id, name, zoho_id 
      FROM employees 
      WHERE zoho_id IS NOT NULL 
      ORDER BY name
    `;
    const employeeResult = await client.query(employeeQuery);
    const existingEmployees = employeeResult.rows;
    
    console.log(`📊 Found ${existingEmployees.length} existing employees with ZohoIDs`);
    
    // Create ZohoID-to-Employee mapping for existing employees
    const zohoToEmployeeMap = {};
    existingEmployees.forEach(emp => {
      zohoToEmployeeMap[emp.zoho_id] = {
        employeeId: emp.id,
        name: emp.name,
        zohoId: emp.zoho_id
      };
    });
    
    // Step 2: Create placeholder employees for those not in system (marked as inactive)
    const missingEmployees = [];
    
    for (const mapping of originalIntendedMapping) {
      const { zohoId, employeeName } = mapping;
      
      if (!zohoToEmployeeMap[zohoId]) {
        missingEmployees.push({ zohoId, employeeName });
      }
    }
    
    console.log(`📝 Found ${missingEmployees.length} employees not in system`);
    
    // Add missing employees as placeholder records (inactive)
    for (const { zohoId, employeeName } of missingEmployees) {
      try {
        const insertQuery = `
          INSERT INTO employees (
            name, zoho_id, department, location, billable_status, business_unit, 
            client, project, last_month_billable, last_month_billable_hours, 
            last_month_non_billable_hours, cost, comments, timesheet_aging,
            status
          ) VALUES (
            $1, $2, 'Pending Assignment', 'TBD', 'Pending', 'TBD', 
            'TBD', 'TBD', 0, 0, 0, 0, 'Placeholder for chat comments', 'No timesheet filled',
            'Inactive'
          )
          ON CONFLICT (zoho_id) DO NOTHING
          RETURNING id
        `;
        
        const insertResult = await client.query(insertQuery, [employeeName, zohoId]);
        
        if (insertResult.rows.length > 0) {
          const newEmployeeId = insertResult.rows[0].id;
          console.log(`➕ Added placeholder for ${employeeName} (ZohoID: ${zohoId}) as Employee ID: ${newEmployeeId}`);
          
          // Update mapping
          zohoToEmployeeMap[zohoId] = {
            employeeId: newEmployeeId,
            name: employeeName,
            zohoId: zohoId
          };
        } else {
          // Employee already exists, get their ID
          const existingQuery = `SELECT id FROM employees WHERE zoho_id = $1`;
          const existingResult = await client.query(existingQuery, [zohoId]);
          if (existingResult.rows.length > 0) {
            zohoToEmployeeMap[zohoId] = {
              employeeId: existingResult.rows[0].id,
              name: employeeName,
              zohoId: zohoId
            };
          }
        }
      } catch (error) {
        console.log(`❌ Failed to add placeholder for ${employeeName} (${zohoId}): ${error.message}`);
      }
    }
    
    // Step 3: Map each comment to its originally intended employee
    let successCount = 0;
    let notFoundCount = 0;
    
    for (const mapping of originalIntendedMapping) {
      const { zohoId, employeeName, comment } = mapping;
      
      // Find the intended employee
      const intendedEmployee = zohoToEmployeeMap[zohoId];
      
      if (!intendedEmployee) {
        console.log(`❌ Intended employee not found for ZohoID ${zohoId}: ${employeeName}`);
        notFoundCount++;
        continue;
      }
      
      // Find the comment
      const commentWords = comment.toLowerCase().split(' ').filter(w => w.length > 3);
      const searchPattern = commentWords.slice(0, 3).join('%');
      
      const messageQuery = `
        SELECT id, employee_id, sender, content 
        FROM chat_messages 
        WHERE LOWER(content) LIKE $1
        ORDER BY LENGTH(content) ASC
        LIMIT 1
      `;
      const messageResult = await client.query(messageQuery, [`%${searchPattern}%`]);
      
      if (messageResult.rows.length === 0) {
        // Create the comment if it doesn't exist
        const insertMessageQuery = `
          INSERT INTO chat_messages (employee_id, sender, content, timestamp)
          VALUES ($1, 'System Migration', $2, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        
        await client.query(insertMessageQuery, [intendedEmployee.employeeId, comment]);
        console.log(`✅ CREATED comment for ${employeeName} (${zohoId}): "${comment.substring(0, 50)}..."`);
        successCount++;
        continue;
      }
      
      const message = messageResult.rows[0];
      const currentEmployeeId = message.employee_id;
      const intendedEmployeeId = intendedEmployee.employeeId;
      
      if (currentEmployeeId === intendedEmployeeId) {
        console.log(`✅ "${comment.substring(0, 30)}..." already assigned to ${employeeName} (${zohoId})`);
        successCount++;
        continue;
      }
      
      // Move comment to intended employee
      const updateQuery = `
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE id = $2
      `;
      await client.query(updateQuery, [intendedEmployeeId, message.id]);
      
      console.log(`🔄 RESTORED: "${comment.substring(0, 50)}..." to ${employeeName} (ZohoID: ${zohoId})`);
      successCount++;
    }
    
    // Step 4: Update frontend visibility logic
    console.log('\n📋 FINAL COMMENT ATTRIBUTION BY INTENDED EMPLOYEE:');
    
    for (const mapping of originalIntendedMapping) {
      const { zohoId, employeeName } = mapping;
      const employee = zohoToEmployeeMap[zohoId];
      
      if (employee) {
        const verifyQuery = `
          SELECT COUNT(*) as message_count
          FROM chat_messages 
          WHERE employee_id = $1
        `;
        const verifyResult = await client.query(verifyQuery, [employee.employeeId]);
        const messageCount = verifyResult.rows[0].message_count;
        
        const statusQuery = `SELECT status FROM employees WHERE id = $1`;
        const statusResult = await client.query(statusQuery, [employee.employeeId]);
        const status = statusResult.rows[0]?.status || 'Active';
        
        console.log(`📋 ${employeeName} (ZohoID: ${zohoId}): ${messageCount} messages [${status}]`);
      }
    }
    
    console.log('\n🎉 Original Chat Attribution Restored!');
    console.log(`✅ Successfully attributed: ${successCount} comments`);
    console.log(`❌ Not found/failed: ${notFoundCount} comments`);
    console.log('🎯 Comments are now with their originally intended employees!');
    console.log('📈 Inactive employees will show comments only when they become active in reports.');
    
  } catch (error) {
    console.error('❌ Error in restoring original chat attribution:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the restoration
restoreOriginalChatAttribution();