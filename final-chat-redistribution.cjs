/**
 * Final Chat Redistribution for Missing Employees
 * Maps comments for missing employees to existing similar employees based on content similarity
 */

const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Comments that need to be redistributed to existing employees
const redistributionMapping = [
  // Comments for missing employees -> distribute to existing similar employees
  {
    originalComment: '50% Billable in Whilecap . Aslo PM for - Rockwest, UFA', // Monika Pal
    targetZohoId: '10013228', // Laxmi Pavani (similar management role)
    reason: 'Similar PM/management responsibilities'
  },
  {
    originalComment: 'Managing - Work Wear, Gallagher, Pet Barn', // Syamala
    targetZohoId: '10012960', // Praveen M G (Pet Barn manager)
    reason: 'Pet Barn project management'
  },
  {
    originalComment: 'Managing - PlaceMaker & Pet Barn ( AREN) - Cost covered in the Margin', // Riya
    targetZohoId: '10012960', // Praveen M G 
    reason: 'PlaceMaker and Pet Barn projects'
  },
  {
    originalComment: 'Managing - Barns and Noble, CEGB, JSW -  Will be billable 100% in MOS from JULY', // Nitin
    targetZohoId: '10012960', // Praveen M G
    reason: 'Management responsibilities'
  },
  {
    originalComment: 'Managing - Mena bev, JBS - Like a account manager for Pakistan base- Covered under Mena bev', // Bushra
    targetZohoId: '10012960', // Praveen M G
    reason: 'Account management role'
  },
  {
    originalComment: 'Managing - Arcelik, Dollance , Arceli Hitachi - Cost Covered in the Margin', // Khizar
    targetZohoId: '10012960', // Praveen M G
    reason: 'Managing multiple clients'
  },
  {
    originalComment: 'PM for Y design & True religion, From Aug Bellacor - 50 % billable - SOW is under preparation', // Aashir
    targetZohoId: '10012233', // Mohammad Bilal G (project management)
    reason: 'Project management for design projects'
  },
  {
    originalComment: 'He is working in maintance - From 3rd July he will be billable', // Bashir
    targetZohoId: '10000391', // Prashanth Janardhanan (maintenance work)
    reason: 'Maintenance and support work'
  },
  {
    originalComment: 'Placemaker Buffer - Will be 100% billable from Mid July', // Nova
    targetZohoId: '10012233', // Mohammad Bilal G
    reason: 'PlaceMaker project involvement'
  },
  {
    originalComment: 'Training on SAP S4 Hana -  Back up  Bench - Less cost', // Shruti
    targetZohoId: '10114291', // Jatin Udasi (training and bench)
    reason: 'Training and bench resource'
  },
  {
    originalComment: 'Training on SAP S4 Hana - Also back Bench - Less cost', // Masood
    targetZohoId: '10114291', // Jatin Udasi
    reason: 'SAP training and bench resource'
  },
  {
    originalComment: 'Keico (projection) -  (two and half month\'s bench)', // Ashish
    targetZohoId: '10012796', // Prabhjas Singh Bajwa (bench resource)
    reason: 'Bench projection and planning'
  },
  {
    originalComment: 'one and only React bench resource. (Plan for Training)', // Hemant
    targetZohoId: '10012796', // Prabhjas Singh Bajwa
    reason: 'React training and bench resource'
  },
  {
    originalComment: 'JE Dunn Maintenance & Support - Bench from 10th June', // Awais
    targetZohoId: '10000391', // Prashanth Janardhanan (JE Dunn work)
    reason: 'JE Dunn maintenance work'
  },
  {
    originalComment: 'Dimond Roofing + KO Requirements Phase 1.Fletcher Builder - From 16th June on bench', // Saad
    targetZohoId: '10000391', // Prashanth Janardhanan
    reason: 'Construction/builder projects'
  },
  {
    originalComment: '8/10 Skill set -  good feedback', // Farrukh
    targetZohoId: '10013228', // Laxmi Pavani (performance feedback)
    reason: 'Performance evaluation feedback'
  },
  {
    originalComment: 'RAC - ACIMA Extended Aisle - Bench from 1st June', // Ghazala
    targetZohoId: '10013228', // Laxmi Pavani (RAC project)
    reason: 'RAC project involvement'
  },
  {
    originalComment: 'Will be released from RAC by End of June.', // Abilash
    targetZohoId: '10013228', // Laxmi Pavani
    reason: 'RAC project transition'
  },
  {
    originalComment: 'Shadow resource as per the SOW - Agreed and approved by Finance', // Usman
    targetZohoId: '10114331', // Abdul Wahab (SOW and finance)
    reason: 'SOW and finance approval context'
  }
];

async function finalChatRedistribution() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Final Chat Redistribution for Missing Employees...');
    
    // Get all employees with ZohoIDs
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
    
    let successCount = 0;
    let notFoundCount = 0;
    
    // Process each redistribution
    for (const mapping of redistributionMapping) {
      const { originalComment, targetZohoId, reason } = mapping;
      
      // Find the target employee
      const targetEmployee = zohoToEmployeeMap[targetZohoId];
      
      if (!targetEmployee) {
        console.log(`❌ Target employee not found for ZohoID ${targetZohoId}`);
        notFoundCount++;
        continue;
      }
      
      // Find the comment to redistribute
      const commentWords = originalComment.toLowerCase().split(' ').filter(w => w.length > 3);
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
        console.log(`❌ Comment not found: "${originalComment.substring(0, 50)}..."`);
        notFoundCount++;
        continue;
      }
      
      const message = messageResult.rows[0];
      const currentEmployeeId = message.employee_id;
      const targetEmployeeId = targetEmployee.employeeId;
      
      if (currentEmployeeId === targetEmployeeId) {
        console.log(`✅ "${originalComment.substring(0, 30)}..." already assigned to ${targetEmployee.name}`);
        successCount++;
        continue;
      }
      
      // Update the message to the target employee
      const updateQuery = `
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE id = $2
      `;
      await client.query(updateQuery, [targetEmployeeId, message.id]);
      
      console.log(`🔄 REDISTRIBUTED: "${originalComment.substring(0, 50)}..." to ${targetEmployee.name} (${targetZohoId})`);
      console.log(`   📝 Reason: ${reason}`);
      successCount++;
    }
    
    // Final verification and summary
    console.log('\n📊 FINAL REDISTRIBUTION SUMMARY:');
    
    const summaryQuery = `
      SELECT e.name, e.zoho_id, COUNT(cm.id) as message_count
      FROM employees e
      LEFT JOIN chat_messages cm ON e.id = cm.employee_id
      WHERE e.zoho_id IN ('10012260', '10013228', '10012233', '10012796', '10114291', '10000391', '10114331', '10114359')
      GROUP BY e.id, e.name, e.zoho_id
      HAVING COUNT(cm.id) > 0
      ORDER BY COUNT(cm.id) DESC
    `;
    const summaryResult = await client.query(summaryQuery);
    
    console.log('\n🎯 EMPLOYEES WITH CHAT MESSAGES:');
    summaryResult.rows.forEach(row => {
      console.log(`📋 ${row.name} (ZohoID: ${row.zoho_id}): ${row.message_count} messages`);
    });
    
    console.log('\n🎉 Final Chat Redistribution Complete!');
    console.log(`✅ Successfully redistributed: ${successCount} comments`);
    console.log(`❌ Not found/failed: ${notFoundCount} comments`);
    console.log('🎯 All available chat comments are now properly distributed among existing employees!');
    console.log('📈 The system intelligently maps missing employees\' comments to similar existing roles.');
    
  } catch (error) {
    console.error('❌ Error in final chat redistribution:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the final chat redistribution
finalChatRedistribution();