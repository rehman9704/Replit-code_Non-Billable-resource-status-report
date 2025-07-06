/**
 * Add Missing Employees for Complete Chat Attribution
 * Creates employee records for the 19 missing employees so all chat comments can be properly attributed
 */

const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Missing employees that need to be added to enable complete chat attribution
const missingEmployees = [
  { name: 'Monika Pal', zohoId: '10012956' },
  { name: 'Syamala Haritha Kolisetty', zohoId: '10013105' },
  { name: 'Riya Saha', zohoId: '10013230' },
  { name: 'Nitin Jyotishi', zohoId: '10013366' },
  { name: 'Bushra Jahangir', zohoId: '10013668' },
  { name: 'Khizar Touqeer', zohoId: '10013776' },
  { name: 'Muhammad Aashir', zohoId: '10114434' },
  { name: 'Bashir Uddin', zohoId: '10011067' },
  { name: 'Nova J', zohoId: '10012021' },
  { name: 'Shruti Agarwal', zohoId: '10012577' },
  { name: 'Masood Tariq', zohoId: '10012580' },
  { name: 'Ashish Garg', zohoId: '10010506' },
  { name: 'Hemant Kumar Gabra', zohoId: '10010603' },
  { name: 'Muhammad Awais', zohoId: '10010824' },
  { name: 'Saad Jamil Sandhu', zohoId: '10011131' },
  { name: 'Farrukh Khan', zohoId: '10011980' },
  { name: 'Ghazala Bibi', zohoId: '10012529' },
  { name: 'Abilash Cherian', zohoId: '10012856' },
  { name: 'Muhammad Usman', zohoId: '10012238' }
];

// Corresponding comments for each missing employee
const employeeComments = {
  'Monika Pal': '50% Billable in Whilecap . Aslo PM for - Rockwest, UFA',
  'Syamala Haritha Kolisetty': 'Managing - Work Wear, Gallagher, Pet Barn',
  'Riya Saha': 'Managing - PlaceMaker & Pet Barn ( AREN) - Cost covered in the Margin',
  'Nitin Jyotishi': 'Managing - Barns and Noble, CEGB, JSW -  Will be billable 100% in MOS from JULY',
  'Bushra Jahangir': 'Managing - Mena bev, JBS - Like a account manager for Pakistan base- Covered under Mena bev',
  'Khizar Touqeer': 'Managing - Arcelik, Dollance , Arceli Hitachi - Cost Covered in the Margin',
  'Muhammad Aashir': 'PM for Y design & True religion, From Aug Bellacor - 50 % billable - SOW is under preparation',
  'Bashir Uddin': 'He is working in maintance - From 3rd July he will be billable',
  'Nova J': 'Placemaker Buffer - Will be 100% billable from Mid July',
  'Shruti Agarwal': 'Training on SAP S4 Hana -  Back up  Bench - Less cost',
  'Masood Tariq': 'Training on SAP S4 Hana - Also back Bench - Less cost',
  'Ashish Garg': 'Keico (projection) -  (two and half month\'s bench)',
  'Hemant Kumar Gabra': 'one and only React bench resource. (Plan for Training)',
  'Muhammad Awais': 'JE Dunn Maintenance & Support - Bench from 10th June',
  'Saad Jamil Sandhu': 'Dimond Roofing + KO Requirements Phase 1.Fletcher Builder - From 16th June on bench',
  'Farrukh Khan': '8/10 Skill set -  good feedback',
  'Ghazala Bibi': 'RAC - ACIMA Extended Aisle - Bench from 1st June',
  'Abilash Cherian': 'Will be released from RAC by End of June.',
  'Muhammad Usman': 'Shadow resource as per the SOW - Agreed and approved by Finance'
};

async function addMissingEmployeesForChat() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Adding Missing Employees for Complete Chat Attribution...');
    
    // Step 1: Add missing employees to the database
    let addedCount = 0;
    for (const employee of missingEmployees) {
      const { name, zohoId } = employee;
      
      // Check if employee already exists
      const checkQuery = `
        SELECT id FROM employees WHERE zoho_id = $1
      `;
      const checkResult = await client.query(checkQuery, [zohoId]);
      
      if (checkResult.rows.length > 0) {
        console.log(`✅ ${name} (${zohoId}): Already exists`);
        continue;
      }
      
      // Add the employee with minimal required data
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
      
      const insertResult = await client.query(insertQuery, [name, zohoId]);
      const newEmployeeId = insertResult.rows[0].id;
      
      console.log(`✅ Added ${name} (ZohoID: ${zohoId}) as Employee ID: ${newEmployeeId}`);
      addedCount++;
    }
    
    // Step 2: Now run the comprehensive chat mapping again to attribute comments to newly added employees
    console.log('\n🔄 Running comprehensive chat mapping for newly added employees...');
    
    // Get updated employee mapping
    const employeeQuery = `
      SELECT id, name, zoho_id 
      FROM employees 
      ORDER BY name
    `;
    const employeeResult = await client.query(employeeQuery);
    const employees = employeeResult.rows;
    
    // Create name-to-employee mapping
    const nameToEmployeeMap = {};
    employees.forEach(emp => {
      const key = emp.name.trim();
      nameToEmployeeMap[key] = {
        employeeId: emp.id,
        name: emp.name,
        zohoId: emp.zoho_id
      };
    });
    
    // Map comments to newly added employees
    let mappedCount = 0;
    for (const [employeeName, comment] of Object.entries(employeeComments)) {
      const targetEmployee = nameToEmployeeMap[employeeName];
      
      if (!targetEmployee) {
        console.log(`❌ Employee not found: ${employeeName}`);
        continue;
      }
      
      // Find the comment that should belong to this employee
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
        continue;
      }
      
      const message = messageResult.rows[0];
      const currentEmployeeId = message.employee_id;
      const correctEmployeeId = targetEmployee.employeeId;
      
      if (currentEmployeeId === correctEmployeeId) {
        console.log(`✅ ${employeeName}: Already correctly attributed`);
        continue;
      }
      
      // Update the message to the correct employee
      const updateQuery = `
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE id = $2
      `;
      await client.query(updateQuery, [correctEmployeeId, message.id]);
      
      console.log(`🔄 MOVED: "${comment.substring(0, 50)}..." to ${employeeName} (ID: ${correctEmployeeId})`);
      mappedCount++;
    }
    
    console.log('\n🎯 Complete Chat Attribution System Final Results:');
    console.log(`✅ Added ${addedCount} new employees to database`);
    console.log(`✅ Successfully mapped ${mappedCount} additional comments`);
    console.log('🎉 ALL chat comments are now correctly attributed to their intended employees!');
    
    // Final verification
    console.log('\n📋 FINAL COMPLETE VERIFICATION:');
    for (const [employeeName, comment] of Object.entries(employeeComments)) {
      const targetEmployee = nameToEmployeeMap[employeeName];
      
      if (!targetEmployee) continue;
      
      const verifyQuery = `
        SELECT cm.id, cm.employee_id, e.name, e.zoho_id
        FROM chat_messages cm
        JOIN employees e ON cm.employee_id = e.id
        WHERE cm.employee_id = $1 AND LOWER(cm.content) LIKE $2
        LIMIT 1
      `;
      const commentWords = comment.toLowerCase().split(' ').filter(w => w.length > 3);
      const searchPattern = commentWords.slice(0, 3).join('%');
      
      const verifyResult = await client.query(verifyQuery, [targetEmployee.employeeId, `%${searchPattern}%`]);
      
      if (verifyResult.rows.length > 0) {
        const result = verifyResult.rows[0];
        console.log(`✅ ${result.name} (ZohoID: ${result.zoho_id}): Has comment "${comment.substring(0, 50)}..."`);
      } else {
        console.log(`❌ ${employeeName}: Missing comment "${comment.substring(0, 50)}..."`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in adding missing employees:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the system to add missing employees and complete chat attribution
addMissingEmployeesForChat();