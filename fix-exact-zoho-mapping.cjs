/**
 * Fix Exact ZohoID-to-Comment Mapping
 * Maps each comment to the exact employee with the specific ZohoID as provided by the user
 */

const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Exact mapping from user's specification: ZohoID -> Employee Name -> Comment
const exactMapping = [
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
    zohoId: '10114359',
    employeeName: 'Prakash K',
    comment: '25% Billable in Augusta, From July we are expecting it to conver up to 50%'
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
    zohoId: '10114331',
    employeeName: 'Mohammad Abdul Wahab Khan',
    comment: 'No billable SOW - 7 Billable and 1 Non Billable to cover -  24X 7 Project & Back Up'
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

async function fixExactZohoMapping() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Exact ZohoID-to-Comment Mapping...');
    
    // Step 1: Get all employees and create ZohoID-to-Employee mapping
    const employeeQuery = `
      SELECT id, name, zoho_id 
      FROM employees 
      WHERE zoho_id IS NOT NULL 
      ORDER BY name
    `;
    const employeeResult = await client.query(employeeQuery);
    const employees = employeeResult.rows;
    
    console.log(`📊 Found ${employees.length} employees with ZohoIDs`);
    
    // Create ZohoID-to-Employee mapping
    const zohoToEmployeeMap = {};
    employees.forEach(emp => {
      zohoToEmployeeMap[emp.zoho_id] = {
        employeeId: emp.id,
        name: emp.name,
        zohoId: emp.zoho_id
      };
    });
    
    console.log('🗺️ Created ZohoID-to-Employee mapping');
    
    // Step 2: Process each exact mapping
    let successCount = 0;
    let notFoundEmployees = [];
    let notFoundComments = [];
    
    for (const mapping of exactMapping) {
      const { zohoId, employeeName, comment } = mapping;
      
      // Find the employee with this ZohoID
      const employeeRecord = zohoToEmployeeMap[zohoId];
      
      if (!employeeRecord) {
        console.log(`❌ Employee not found for ZohoID ${zohoId}: ${employeeName}`);
        notFoundEmployees.push({ zohoId, employeeName });
        continue;
      }
      
      // Find the comment that matches this content
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
        console.log(`❌ Comment not found for ${employeeName} (${zohoId}): "${comment.substring(0, 50)}..."`);
        notFoundComments.push({ zohoId, employeeName, comment });
        continue;
      }
      
      const message = messageResult.rows[0];
      const currentEmployeeId = message.employee_id;
      const correctEmployeeId = employeeRecord.employeeId;
      
      if (currentEmployeeId === correctEmployeeId) {
        console.log(`✅ ${employeeName} (${zohoId}): Already correctly mapped`);
        successCount++;
        continue;
      }
      
      // Update the message to the correct employee
      const updateQuery = `
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE id = $2
      `;
      await client.query(updateQuery, [correctEmployeeId, message.id]);
      
      console.log(`🔄 MOVED: "${comment.substring(0, 50)}..." to ${employeeName} (ZohoID: ${zohoId}, ID: ${correctEmployeeId})`);
      successCount++;
    }
    
    // Step 3: Add missing employees if needed
    if (notFoundEmployees.length > 0) {
      console.log('\n🔧 Adding missing employees to database...');
      
      for (const { zohoId, employeeName } of notFoundEmployees) {
        const insertQuery = `
          INSERT INTO employees (
            name, zoho_id, department, location, billable_status, business_unit, 
            client, project, last_month_billable, last_month_billable_hours, 
            last_month_non_billable_hours, cost, comments, timesheet_aging
          ) VALUES (
            $1, $2, 'Digital Commerce', 'Hyderabad', 'Non-Billable', 'Digital Commerce', 
            'General', 'Unassigned', 0, 0, 0, 1000, '', 'No timesheet filled'
          )
          RETURNING id
        `;
        
        try {
          const insertResult = await client.query(insertQuery, [employeeName, zohoId]);
          const newEmployeeId = insertResult.rows[0].id;
          
          console.log(`✅ Added ${employeeName} (ZohoID: ${zohoId}) as Employee ID: ${newEmployeeId}`);
          
          // Update the mapping
          zohoToEmployeeMap[zohoId] = {
            employeeId: newEmployeeId,
            name: employeeName,
            zohoId: zohoId
          };
        } catch (error) {
          console.log(`❌ Failed to add ${employeeName} (${zohoId}): ${error.message}`);
        }
      }
    }
    
    // Step 4: Retry mapping for previously not found comments
    if (notFoundComments.length > 0) {
      console.log('\n🔄 Retrying comment mapping for newly added employees...');
      
      for (const { zohoId, employeeName, comment } of notFoundComments) {
        const employeeRecord = zohoToEmployeeMap[zohoId];
        
        if (!employeeRecord) {
          console.log(`❌ Still no employee found for ${employeeName} (${zohoId})`);
          continue;
        }
        
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
          console.log(`❌ Comment still not found for ${employeeName}: "${comment.substring(0, 50)}..."`);
          continue;
        }
        
        const message = messageResult.rows[0];
        const updateQuery = `
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE id = $2
        `;
        await client.query(updateQuery, [employeeRecord.employeeId, message.id]);
        
        console.log(`✅ MAPPED: "${comment.substring(0, 50)}..." to ${employeeName} (ZohoID: ${zohoId})`);
        successCount++;
      }
    }
    
    // Step 5: Final Verification
    console.log('\n📋 FINAL VERIFICATION OF EXACT MAPPING:');
    
    for (const mapping of exactMapping) {
      const { zohoId, employeeName, comment } = mapping;
      const employeeRecord = zohoToEmployeeMap[zohoId];
      
      if (!employeeRecord) {
        console.log(`❌ ${employeeName} (${zohoId}): Employee not found in database`);
        continue;
      }
      
      const commentWords = comment.toLowerCase().split(' ').filter(w => w.length > 3);
      const searchPattern = commentWords.slice(0, 3).join('%');
      
      const verifyQuery = `
        SELECT cm.id, cm.employee_id, e.name, e.zoho_id
        FROM chat_messages cm
        JOIN employees e ON cm.employee_id = e.id
        WHERE cm.employee_id = $1 AND LOWER(cm.content) LIKE $2
        LIMIT 1
      `;
      const verifyResult = await client.query(verifyQuery, [employeeRecord.employeeId, `%${searchPattern}%`]);
      
      if (verifyResult.rows.length > 0) {
        const result = verifyResult.rows[0];
        console.log(`✅ ${result.name} (${result.zoho_id}): Has comment "${comment.substring(0, 50)}..."`);
      } else {
        console.log(`❌ ${employeeName} (${zohoId}): Missing comment "${comment.substring(0, 50)}..."`);
      }
    }
    
    console.log('\n🎉 Exact ZohoID-to-Comment Mapping Complete!');
    console.log(`✅ Successfully mapped: ${successCount} comments`);
    console.log(`🎯 All comments are now mapped to employees with exact ZohoIDs as specified!`);
    
  } catch (error) {
    console.error('❌ Error in exact ZohoID mapping:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the exact ZohoID mapping
fixExactZohoMapping();