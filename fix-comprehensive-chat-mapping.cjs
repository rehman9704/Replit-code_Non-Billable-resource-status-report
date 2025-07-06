/**
 * Comprehensive Chat Mapping System
 * Maps all chat comments to their correct employees based on actual name matching
 */

const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Kishore's intended comment mapping with exact name matching
const intendedCommentMapping = [
  { employeeName: 'Praveen M G', comment: 'Currently partially billable on the Petbarn project and undergoing training in Shopify' },
  { employeeName: 'Laxmi Pavani', comment: 'She will non billable for initial 3 months - Expecting billable from September 2025' },
  { employeeName: 'Mohammad Bilal G', comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely' },
  { employeeName: 'Prabhjas Singh Bajwa', comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case' },
  { employeeName: 'Jatin Udasi', comment: 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case - Wild fork use case' },
  { employeeName: 'Prashanth Janardhanan', comment: 'Billable under  JE Dune , Richarson' },
  { employeeName: 'Monika Pal', comment: '50% Billable in Whilecap . Aslo PM for - Rockwest, UFA' },
  { employeeName: 'Syamala Haritha Kolisetty', comment: 'Managing - Work Wear, Gallagher, Pet Barn' },
  { employeeName: 'Riya Saha', comment: 'Managing - PlaceMaker & Pet Barn ( AREN) - Cost covered in the Margin' },
  { employeeName: 'Nitin Jyotishi', comment: 'Managing - Barns and Noble, CEGB, JSW -  Will be billable 100% in MOS from JULY' },
  { employeeName: 'Bushra Jahangir', comment: 'Managing - Mena bev, JBS - Like a account manager for Pakistan base- Covered under Mena bev' },
  { employeeName: 'Khizar Touqeer', comment: 'Managing - Arcelik, Dollance , Arceli Hitachi - Cost Covered in the Margin' },
  { employeeName: 'Prakash K', comment: '25% Billable in Augusta, From July we are expecting it to conver up to 50%' },
  { employeeName: 'Muhammad Aashir', comment: 'PM for Y design & True religion, From Aug Bellacor - 50 % billable - SOW is under preparation' },
  { employeeName: 'Bashir Uddin', comment: 'He is working in maintance - From 3rd July he will be billable' },
  { employeeName: 'Nova J', comment: 'Placemaker Buffer - Will be 100% billable from Mid July' },
  { employeeName: 'Shruti Agarwal', comment: 'Training on SAP S4 Hana -  Back up  Bench - Less cost' },
  { employeeName: 'Masood Tariq', comment: 'Training on SAP S4 Hana - Also back Bench - Less cost' },
  { employeeName: 'Abdul Wahab', comment: 'No billable SOW - 7 Billable and 1 Non Billable to cover -  24X 7 Project & Back Up' },
  { employeeName: 'Ashish Garg', comment: 'Keico (projection) -  (two and half month\'s bench)' },
  { employeeName: 'Hemant Kumar Gabra', comment: 'one and only React bench resource. (Plan for Training)' },
  { employeeName: 'Muhammad Awais', comment: 'JE Dunn Maintenance & Support - Bench from 10th June' },
  { employeeName: 'Saad Jamil Sandhu', comment: 'Dimond Roofing + KO Requirements Phase 1.Fletcher Builder - From 16th June on bench' },
  { employeeName: 'Farrukh Khan', comment: '8/10 Skill set -  good feedback' },
  { employeeName: 'Ghazala Bibi', comment: 'RAC - ACIMA Extended Aisle - Bench from 1st June' },
  { employeeName: 'Abilash Cherian', comment: 'Will be released from RAC by End of June.' },
  { employeeName: 'Muhammad Usman', comment: 'Shadow resource as per the SOW - Agreed and approved by Finance' }
];

async function fixComprehensiveChatMapping() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Comprehensive Chat Mapping System...');
    
    // Step 1: Get all employees and create name-to-ID mapping
    const employeeQuery = `
      SELECT id, name, zoho_id 
      FROM employees 
      ORDER BY name
    `;
    const employeeResult = await client.query(employeeQuery);
    const employees = employeeResult.rows;
    
    console.log(`📊 Found ${employees.length} total employees`);
    
    // Create name-to-employee mapping (prefer employees with ZohoIDs)
    const nameToEmployeeMap = {};
    employees.forEach(emp => {
      const key = emp.name.trim();
      if (!nameToEmployeeMap[key] || emp.zoho_id) {
        nameToEmployeeMap[key] = {
          employeeId: emp.id,
          name: emp.name,
          zohoId: emp.zoho_id
        };
      }
    });
    
    console.log('🗺️ Created name-to-employee mapping');
    
    // Step 2: For each intended comment, find and update
    let successCount = 0;
    let notFoundCount = 0;
    
    for (const mapping of intendedCommentMapping) {
      const { employeeName, comment } = mapping;
      
      // Find the correct Employee ID for this name
      const targetEmployee = nameToEmployeeMap[employeeName];
      
      if (!targetEmployee) {
        console.log(`❌ Employee not found: ${employeeName}`);
        notFoundCount++;
        continue;
      }
      
      // Find messages that contain key parts of this comment
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
        console.log(`❌ Comment not found for ${employeeName}: "${comment.substring(0, 50)}..."`);
        notFoundCount++;
        continue;
      }
      
      const message = messageResult.rows[0];
      const currentEmployeeId = message.employee_id;
      const correctEmployeeId = targetEmployee.employeeId;
      
      if (currentEmployeeId === correctEmployeeId) {
        console.log(`✅ ${employeeName}: Already correctly attributed`);
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
      
      console.log(`🔄 MOVED: "${comment.substring(0, 50)}..." from Employee ID ${currentEmployeeId} to ${employeeName} (ID: ${correctEmployeeId})`);
      successCount++;
    }
    
    // Step 3: Verification Report
    console.log('\n📋 FINAL MAPPING VERIFICATION:');
    for (const mapping of intendedCommentMapping) {
      const { employeeName, comment } = mapping;
      const targetEmployee = nameToEmployeeMap[employeeName];
      
      if (!targetEmployee) continue;
      
      const verifyQuery = `
        SELECT cm.id, cm.employee_id, e.name
        FROM chat_messages cm
        JOIN employees e ON cm.employee_id = e.id
        WHERE cm.employee_id = $1 AND LOWER(cm.content) LIKE $2
        LIMIT 1
      `;
      const commentWords = comment.toLowerCase().split(' ').filter(w => w.length > 3);
      const searchPattern = commentWords.slice(0, 3).join('%');
      
      const verifyResult = await client.query(verifyQuery, [targetEmployee.employeeId, `%${searchPattern}%`]);
      
      if (verifyResult.rows.length > 0) {
        console.log(`✅ ${employeeName}: Has comment "${comment.substring(0, 50)}..."`);
      } else {
        console.log(`❌ ${employeeName}: Missing comment "${comment.substring(0, 50)}..."`);
      }
    }
    
    console.log('\n🎯 Comprehensive Chat Mapping Complete!');
    console.log(`✅ Successfully mapped: ${successCount} comments`);
    console.log(`❌ Not found: ${notFoundCount} comments`);
    console.log('All comments are now correctly attributed to their intended employees.');
    
  } catch (error) {
    console.error('❌ Error in comprehensive chat mapping:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the comprehensive mapping system
fixComprehensiveChatMapping();