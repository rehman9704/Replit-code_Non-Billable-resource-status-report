/**
 * Systematic Chat Mapping Fix
 * Redistributes chat messages to the correct employees based on content analysis and business context
 */
const { Pool } = require('pg');

// PostgreSQL configuration
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixSystematicChatMapping() {
  console.log('🔧 SYSTEMATIC CHAT MAPPING REDISTRIBUTION');
  
  try {
    // Get all current chat messages
    const allMessages = await pgPool.query(`
      SELECT id, employee_id, sender, content, timestamp
      FROM chat_messages 
      ORDER BY employee_id, timestamp DESC
    `);
    
    console.log(`\n=== CURRENT MESSAGE DISTRIBUTION ===`);
    console.log(`Total messages: ${allMessages.rows.length}`);
    
    // Group messages by employee_id
    const messagesByEmployee = {};
    allMessages.rows.forEach(msg => {
      if (!messagesByEmployee[msg.employee_id]) {
        messagesByEmployee[msg.employee_id] = [];
      }
      messagesByEmployee[msg.employee_id].push(msg);
    });
    
    Object.keys(messagesByEmployee).forEach(empId => {
      console.log(`Employee ID ${empId}: ${messagesByEmployee[empId].length} messages`);
    });
    
    // Based on content analysis and business context, redistribute messages:
    const redistributionPlan = {
      // Praveen M G (ID 80 → target employee for management content)
      80: {
        targetEmployeeId: 80, // Keep as Praveen-related content
        messages: [
          'Managing - PlaceMaker & Pet Barn ( AREN)',
          'Managing - Barns and Noble, CEGB, JSW',
          'Currently partially billable on the Petbarn project',
          'Petbarn', 'Shopify'
        ],
        description: 'Project management and client engagement content'
      },
      
      // Laxmi Pavani (ID 137 → target for new employee onboarding)
      137: {
        targetEmployeeId: 137, // Keep for Laxmi-related content  
        messages: [
          'She will non billable for initial 3 months',
          'Expecting billable from September'
        ],
        description: 'New employee onboarding and timeline content'
      },
      
      // Training and Development content (ID 11 → specialized training employee)
      11: {
        targetEmployeeId: 11, // Keep for training-focused content
        messages: [
          'Training on SAP S4 Hana',
          'back Bench - Less cost',
          'working in maintenance',
          'become billable starting from',
          'AI training', 'development'
        ],
        description: 'Training and development focused content'
      }
    };
    
    console.log('\n=== REDISTRIBUTION PLAN ===');
    Object.keys(redistributionPlan).forEach(sourceId => {
      const plan = redistributionPlan[sourceId];
      console.log(`\nEmployee ID ${sourceId} → Employee ID ${plan.targetEmployeeId}`);
      console.log(`Purpose: ${plan.description}`);
      console.log(`Keywords: ${plan.messages.join(', ')}`);
    });
    
    // Apply content-based filtering to keep messages with relevant employees
    let keptCount = 0;
    let movedCount = 0;
    
    for (const empId of Object.keys(messagesByEmployee)) {
      const messages = messagesByEmployee[empId];
      const plan = redistributionPlan[empId];
      
      if (!plan) {
        // Move messages from unmapped employees to appropriate targets based on content
        for (const msg of messages) {
          let targetId = null;
          
          if (msg.content.toLowerCase().includes('training') || 
              msg.content.toLowerCase().includes('sap') ||
              msg.content.toLowerCase().includes('maintenance')) {
            targetId = 11; // Training content
          } else if (msg.content.toLowerCase().includes('managing') ||
                     msg.content.toLowerCase().includes('petbarn') ||
                     msg.content.toLowerCase().includes('shopify')) {
            targetId = 80; // Management content
          } else if (msg.content.toLowerCase().includes('non billable for initial') ||
                     msg.content.toLowerCase().includes('expecting billable from september')) {
            targetId = 137; // Onboarding content
          } else {
            targetId = 50; // General business content
          }
          
          if (targetId !== parseInt(empId)) {
            await pgPool.query(`
              UPDATE chat_messages 
              SET employee_id = $1
              WHERE id = $2
            `, [targetId, msg.id]);
            
            console.log(`📝 Moved message ${msg.id} from ID ${empId} → ID ${targetId}`);
            movedCount++;
          } else {
            keptCount++;
          }
        }
      } else {
        // Keep messages that match the plan
        console.log(`✅ Keeping ${messages.length} messages for Employee ID ${empId} (${plan.description})`);
        keptCount += messages.length;
      }
    }
    
    console.log(`\n📊 REDISTRIBUTION SUMMARY:`);
    console.log(`Messages kept in place: ${keptCount}`);
    console.log(`Messages redistributed: ${movedCount}`);
    
    // Final verification
    const finalDistribution = await pgPool.query(`
      SELECT employee_id, COUNT(*) as message_count, 
             STRING_AGG(LEFT(content, 50), '; ' ORDER BY timestamp DESC) as sample_content
      FROM chat_messages 
      GROUP BY employee_id
      ORDER BY employee_id
    `);
    
    console.log('\n=== FINAL MESSAGE DISTRIBUTION ===');
    finalDistribution.rows.forEach(row => {
      console.log(`Employee ID ${row.employee_id}: ${row.message_count} messages`);
      console.log(`  Sample: ${row.sample_content}`);
    });
    
    await pgPool.end();
    
    console.log('\n✅ SYSTEMATIC CHAT MAPPING COMPLETE');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixSystematicChatMapping();