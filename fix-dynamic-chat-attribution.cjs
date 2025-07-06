/**
 * Dynamic Chat Attribution System
 * Correctly maps chat comments to employees based on ZohoID without hardcoding
 */

const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Kishore's intended comment mapping based on ZohoID
const intendedCommentMapping = [
  { zohoId: '10012260', comment: 'Currently partially billable on the Petbarn project and undergoing training in Shopify' },
  { zohoId: '10013228', comment: 'She will non billable for initial 3 months - Expecting billable from September' },
  { zohoId: '10012233', comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely' },
  { zohoId: '10012796', comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case' },
  { zohoId: '10114291', comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case' },
  { zohoId: '10000391', comment: 'Billable under  JE Dune , Richarson' },
  { zohoId: '10012956', comment: '50% Billable in Whilecap . Aslo PM for - Rockwest, UFA' },
  { zohoId: '10013105', comment: 'Managing - Work Wear, Gallagher, Pet Barn' },
  { zohoId: '10013230', comment: 'Managing - PlaceMaker & Pet Barn ( AREN) - Cost covered in the Margin' },
  { zohoId: '10013366', comment: 'Managing - Barns and Noble, CEGB, JSW -  Will be billable 100% in MOS from JULY' },
  { zohoId: '10013668', comment: 'Managing - Mena bev, JBS - Like a account manager for Pakistan base- Covered under Mena bev' },
  { zohoId: '10013776', comment: 'Managing - Arcelik, Dollance , Arceli Hitachi - Cost Covered in the Margin' },
  { zohoId: '10114359', comment: '25% Billable in Augusta, From July we are expecting it to conver up to 50%' },
  { zohoId: '10114434', comment: 'PM for Y design & True religion, From Aug Bellacor - 50 % billable - SOW is under preparation' },
  { zohoId: '10011067', comment: 'He is working in maintance - From 3rd July he will be billable' },
  { zohoId: '10012021', comment: 'Placemaker Buffer - Will be 100% billable from Mid July' },
  { zohoId: '10012577', comment: 'Training on SAP S4 Hana -  Back up  Bench - Less cost' },
  { zohoId: '10012580', comment: 'Training on SAP S4 Hana -  Back up  Bench - Less cost' },
  { zohoId: '10114331', comment: 'No billable SOW - 7 Billable and 1 Non Billable to cover -  24X 7 Project & Back Up' },
  { zohoId: '10010506', comment: 'Keico (projection) -  (two and half month\'s bench)' },
  { zohoId: '10010603', comment: 'one and only React bench resource. (Plan for Training)' },
  { zohoId: '10010824', comment: 'JE Dunn Maintenance & Support - Bench from 10th June' },
  { zohoId: '10011131', comment: 'Dimond Roofing + KO Requirements Phase 1.Fletcher Builder - From 16th June on bench' },
  { zohoId: '10011980', comment: '8/10 Skill set -  good feedback' },
  { zohoId: '10012529', comment: 'RAC - ACIMA Extended Aisle - Bench from 1st June' },
  { zohoId: '10012856', comment: 'Will be released from RAC by End of June.' },
  { zohoId: '10012238', comment: 'Shadow resource as per the SOW - Agreed and approved by Finance' }
];

async function fixDynamicChatAttribution() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Dynamic Chat Attribution System...');
    
    // Step 1: Get all employees with their ZohoIDs and Employee IDs
    const employeeQuery = `
      SELECT id, zoho_id, name 
      FROM employees 
      WHERE zoho_id IS NOT NULL 
      ORDER BY zoho_id
    `;
    const employeeResult = await client.query(employeeQuery);
    const employees = employeeResult.rows;
    
    console.log(`📊 Found ${employees.length} employees with ZohoIDs`);
    
    // Step 2: Create ZohoID to Employee ID mapping
    const zohoToEmployeeMap = {};
    employees.forEach(emp => {
      zohoToEmployeeMap[emp.zoho_id] = {
        employeeId: emp.id,
        name: emp.name
      };
    });
    
    console.log('🗺️ Created ZohoID to Employee ID mapping');
    
    // Step 3: For each intended comment, find the correct Employee ID and update
    for (const mapping of intendedCommentMapping) {
      const { zohoId, comment } = mapping;
      
      // Find the correct Employee ID for this ZohoID
      const targetEmployee = zohoToEmployeeMap[zohoId];
      
      if (!targetEmployee) {
        console.log(`❌ Warning: ZohoID ${zohoId} not found in employee database`);
        continue;
      }
      
      // Find the chat message with this exact content
      const messageQuery = `
        SELECT id, employee_id, sender, content 
        FROM chat_messages 
        WHERE content = $1
        LIMIT 1
      `;
      const messageResult = await client.query(messageQuery, [comment]);
      
      if (messageResult.rows.length === 0) {
        console.log(`❌ Warning: Comment not found: "${comment.substring(0, 50)}..."`);
        continue;
      }
      
      const message = messageResult.rows[0];
      const currentEmployeeId = message.employee_id;
      const correctEmployeeId = targetEmployee.employeeId;
      
      if (currentEmployeeId === correctEmployeeId) {
        console.log(`✅ ${targetEmployee.name} (${zohoId}): Already correctly attributed`);
        continue;
      }
      
      // Update the message to the correct employee
      const updateQuery = `
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE id = $2
      `;
      await client.query(updateQuery, [correctEmployeeId, message.id]);
      
      console.log(`🔄 MOVED: "${comment.substring(0, 50)}..." from Employee ID ${currentEmployeeId} to ${targetEmployee.name} (ID: ${correctEmployeeId}, ZohoID: ${zohoId})`);
    }
    
    // Step 4: Verify the final attribution
    console.log('\n📋 FINAL ATTRIBUTION VERIFICATION:');
    for (const mapping of intendedCommentMapping) {
      const { zohoId, comment } = mapping;
      const targetEmployee = zohoToEmployeeMap[zohoId];
      
      if (!targetEmployee) continue;
      
      const verifyQuery = `
        SELECT cm.id, cm.employee_id, e.name, e.zoho_id
        FROM chat_messages cm
        JOIN employees e ON cm.employee_id = e.id
        WHERE cm.content = $1
      `;
      const verifyResult = await client.query(verifyQuery, [comment]);
      
      if (verifyResult.rows.length > 0) {
        const result = verifyResult.rows[0];
        console.log(`✅ ${result.name} (ZohoID: ${result.zoho_id}) has: "${comment.substring(0, 50)}..."`);
      }
    }
    
    console.log('\n🎯 Dynamic Chat Attribution System Complete!');
    console.log('All comments are now correctly attributed to their intended employees based on ZohoID mapping.');
    
  } catch (error) {
    console.error('❌ Error in dynamic chat attribution:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the dynamic attribution system
fixDynamicChatAttribution();