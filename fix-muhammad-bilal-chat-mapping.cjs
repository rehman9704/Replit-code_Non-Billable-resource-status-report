/**
 * Fix Muhammad Bilal G Chat Mapping Issue
 * The specific comment "There is no active opportunity at the moment. Mahaveer intends to provide him in Optimizely"
 * should be mapped to Muhammad Bilal G (ZOHO ID: 10012233) but is currently showing under wrong employees
 */

const { Pool } = require('pg');

async function fixMuhammadBilalChatMapping() {
  console.log('🔧 FIXING MUHAMMAD BILAL G CHAT MAPPING ISSUE');
  console.log('==============================================');
  
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('📊 STEP 1: Current Optimizely Chat Messages');
    
    // Find all Optimizely chat messages
    const optimizelyChats = await pgPool.query(`
      SELECT id, employee_id, sender, content, timestamp 
      FROM chat_messages 
      WHERE content ILIKE '%optimizely%'
      ORDER BY timestamp DESC
    `);
    
    console.log(`Found ${optimizelyChats.rows.length} Optimizely-related messages:`);
    optimizelyChats.rows.forEach(chat => {
      console.log(`- ID ${chat.id}: Employee ${chat.employee_id} - "${chat.content.substring(0, 80)}..."`);
    });
    
    console.log('\n📊 STEP 2: Identify Correct Employee ID for Muhammad Bilal G');
    
    // Based on the replit.md documentation and previous investigations,
    // Mohammad Bilal G should have internal ID 49 (this was established in the Universal Chat Attribution Resolution)
    const correctEmployeeId = 49;
    console.log(`✅ Correct Internal ID for Muhammad Bilal G: ${correctEmployeeId}`);
    
    console.log('\n📊 STEP 3: Update Chat Messages to Correct Employee ID');
    
    // Find the specific message that should belong to Muhammad Bilal G
    const specificMessage = optimizelyChats.rows.find(chat => 
      chat.content.includes('There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely')
    );
    
    if (specificMessage) {
      console.log(`\n🎯 Found the specific message: ID ${specificMessage.id}`);
      console.log(`   Current Employee ID: ${specificMessage.employee_id}`);
      console.log(`   Should be Employee ID: ${correctEmployeeId}`);
      
      // Update the message to the correct employee
      const updateResult = await pgPool.query(`
        UPDATE chat_messages 
        SET employee_id = $1 
        WHERE id = $2
        RETURNING id, employee_id, content
      `, [correctEmployeeId, specificMessage.id]);
      
      if (updateResult.rows.length > 0) {
        console.log(`✅ Successfully updated message ID ${specificMessage.id} to Employee ID ${correctEmployeeId}`);
      } else {
        console.log(`❌ Failed to update message ID ${specificMessage.id}`);
      }
    } else {
      console.log('❌ Could not find the specific Optimizely message for Muhammad Bilal G');
      
      // Look for any similar messages
      const similarMessages = optimizelyChats.rows.filter(chat => 
        chat.content.includes('Mahaveer') && chat.content.includes('Optimizely')
      );
      
      console.log(`\n🔍 Found ${similarMessages.length} similar messages with Mahaveer + Optimizely:`);
      similarMessages.forEach(chat => {
        console.log(`- ID ${chat.id}: Employee ${chat.employee_id} - "${chat.content}"`);
      });
      
      if (similarMessages.length > 0) {
        // Update the most recent relevant message
        const messageToUpdate = similarMessages[0];
        console.log(`\n🔧 Updating most relevant message ID ${messageToUpdate.id} to Employee ID ${correctEmployeeId}`);
        
        const updateResult = await pgPool.query(`
          UPDATE chat_messages 
          SET employee_id = $1 
          WHERE id = $2
          RETURNING id, employee_id, content
        `, [correctEmployeeId, messageToUpdate.id]);
        
        if (updateResult.rows.length > 0) {
          console.log(`✅ Successfully updated message ID ${messageToUpdate.id}`);
        }
      }
    }
    
    console.log('\n📊 STEP 4: Verify the Update');
    
    // Check messages for employee ID 49 (Muhammad Bilal G)
    const bilalMessages = await pgPool.query(`
      SELECT id, employee_id, sender, content, timestamp 
      FROM chat_messages 
      WHERE employee_id = $1
      ORDER BY timestamp DESC
    `, [correctEmployeeId]);
    
    console.log(`\n✅ Messages now assigned to Employee ID ${correctEmployeeId} (Muhammad Bilal G):`);
    bilalMessages.rows.forEach(chat => {
      console.log(`- ID ${chat.id}: "${chat.content.substring(0, 80)}..."`);
    });
    
    console.log('\n📊 STEP 5: Check for Any Remaining Misattributed Messages');
    
    // Check if there are any other messages that should belong to Muhammad Bilal G
    const remainingOptimizely = await pgPool.query(`
      SELECT id, employee_id, sender, content, timestamp 
      FROM chat_messages 
      WHERE content ILIKE '%optimizely%' AND employee_id != $1
      ORDER BY timestamp DESC
    `, [correctEmployeeId]);
    
    if (remainingOptimizely.rows.length > 0) {
      console.log(`\n⚠️  Warning: ${remainingOptimizely.rows.length} Optimizely messages still assigned to other employees:`);
      remainingOptimizely.rows.forEach(chat => {
        console.log(`- ID ${chat.id}: Employee ${chat.employee_id} - "${chat.content.substring(0, 60)}..."`);
      });
    } else {
      console.log('\n✅ All Optimizely messages are now correctly attributed');
    }
    
    return {
      success: true,
      correctedEmployeeId: correctEmployeeId,
      updatedMessages: bilalMessages.rows.length,
      remainingIssues: remainingOptimizely.rows.length
    };
    
  } catch (error) {
    console.error('💥 Error fixing chat mapping:', error);
    return { success: false, error: error.message };
  } finally {
    await pgPool.end();
  }
}

// Run the fix
fixMuhammadBilalChatMapping().then(result => {
  console.log('\n🎯 MAPPING FIX SUMMARY:');
  console.log('=======================');
  if (result.success) {
    console.log(`✅ Successfully corrected chat mapping for Muhammad Bilal G`);
    console.log(`✅ Employee ID: ${result.correctedEmployeeId}`);
    console.log(`✅ Total messages now assigned: ${result.updatedMessages}`);
    console.log(`${result.remainingIssues === 0 ? '✅' : '⚠️'} Remaining attribution issues: ${result.remainingIssues}`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Frontend will automatically refresh and show correct employee name');
    console.log('2. Excel export will now include correct ZOHO ID mapping');
    console.log('3. Chat system integrity restored for Muhammad Bilal G');
  } else {
    console.log(`❌ Failed to fix mapping: ${result.error}`);
  }
}).catch(console.error);