/**
 * TEST SCRIPT: Praveen M G Chat History Fix
 * 
 * This script tests the specific issue reported:
 * 1. Muhammad Rehman Shahid adds comment for Praveen M G (ZohoID: 10012260)
 * 2. Timesheet admin adds comment later
 * 3. Verify both comments are preserved in chat history
 */

const { db } = require('./server/db.js');
const { liveChatData } = require('./shared/schema.js');
const { updateLiveChatComment } = require('./server/live-chat-sync.js');
const { eq } = require('drizzle-orm');

async function testPraveenChatHistoryFix() {
  console.log('🧪 TESTING: Praveen M G Chat History Fix');
  console.log('================================================');
  
  const zohoId = '10012260';
  const employeeName = 'Praveen M G';
  
  try {
    // Step 1: Clear any existing data for clean test
    console.log('🧹 Step 1: Clearing existing data for clean test...');
    await db.delete(liveChatData).where(eq(liveChatData.zohoId, zohoId));
    console.log('✅ Existing data cleared');
    
    // Step 2: Muhammad Rehman Shahid adds first comment
    console.log('\n📝 Step 2: Muhammad Rehman Shahid adds first comment...');
    const firstComment = "Currently partially billable on the Petbarn project. Will be made fully billable from 1st August onwards.";
    const success1 = await updateLiveChatComment(zohoId, firstComment, 'Muhammad Rehman Shahid');
    
    if (success1) {
      console.log('✅ First comment added successfully');
      
      // Check the database state
      const [record1] = await db.select().from(liveChatData).where(eq(liveChatData.zohoId, zohoId));
      if (record1) {
        const history1 = JSON.parse(record1.chatHistory || '[]');
        console.log(`📊 Database state after first comment: ${history1.length} messages in history`);
        console.log(`📋 Latest comment: "${record1.comments}"`);
        console.log(`👤 Comment by: ${record1.commentsEnteredBy}`);
      }
    } else {
      console.log('❌ First comment failed');
      return;
    }
    
    // Step 3: Timesheet admin adds second comment
    console.log('\n📝 Step 3: Timesheet admin adds second comment...');
    const secondComment = "Employee performance review scheduled for next week. Focus on Petbarn project deliverables.";
    const success2 = await updateLiveChatComment(zohoId, secondComment, 'Timesheet Admin');
    
    if (success2) {
      console.log('✅ Second comment added successfully');
      
      // Check the database state
      const [record2] = await db.select().from(liveChatData).where(eq(liveChatData.zohoId, zohoId));
      if (record2) {
        const history2 = JSON.parse(record2.chatHistory || '[]');
        console.log(`📊 Database state after second comment: ${history2.length} messages in history`);
        console.log(`📋 Latest comment: "${record2.comments}"`);
        console.log(`👤 Comment by: ${record2.commentsEnteredBy}`);
        
        // Verify chat history integrity
        if (history2.length === 2) {
          console.log('\n✅ SUCCESS: Chat history preserved correctly!');
          console.log('📋 Complete chat history:');
          history2.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.timestamp}] ${msg.sentBy}: "${msg.message}"`);
          });
        } else {
          console.log(`❌ FAILURE: Expected 2 messages, found ${history2.length}`);
          return;
        }
      }
    } else {
      console.log('❌ Second comment failed');
      return;
    }
    
    // Step 4: Add third comment to further test
    console.log('\n📝 Step 4: Adding third comment to test comprehensive history...');
    const thirdComment = "Updated status: Fully billable on Petbarn project starting August 1st.";
    const success3 = await updateLiveChatComment(zohoId, thirdComment, 'Muhammad Rehman Shahid');
    
    if (success3) {
      console.log('✅ Third comment added successfully');
      
      // Final verification
      const [finalRecord] = await db.select().from(liveChatData).where(eq(liveChatData.zohoId, zohoId));
      if (finalRecord) {
        const finalHistory = JSON.parse(finalRecord.chatHistory || '[]');
        console.log(`📊 Final database state: ${finalHistory.length} messages in history`);
        
        if (finalHistory.length === 3) {
          console.log('\n🎉 COMPREHENSIVE SUCCESS: All chat history preserved!');
          console.log('📋 Complete conversation history:');
          finalHistory.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${new Date(msg.timestamp).toLocaleString()}] ${msg.sentBy}:`);
            console.log(`      "${msg.message}"`);
          });
          
          // Verify no messages were lost
          const hasFirstMessage = finalHistory.some(msg => msg.message.includes('partially billable'));
          const hasSecondMessage = finalHistory.some(msg => msg.message.includes('performance review'));
          const hasThirdMessage = finalHistory.some(msg => msg.message.includes('Fully billable'));
          
          if (hasFirstMessage && hasSecondMessage && hasThirdMessage) {
            console.log('\n✅ VERIFICATION COMPLETE: All messages preserved correctly!');
            console.log('🔧 The chat history fix is working properly.');
          } else {
            console.log('\n❌ VERIFICATION FAILED: Some messages were lost');
          }
        } else {
          console.log(`❌ FAILURE: Expected 3 messages, found ${finalHistory.length}`);
        }
      }
    }
    
    console.log('\n================================================');
    console.log('🧪 TEST COMPLETED: Praveen M G Chat History Fix');
    
  } catch (error) {
    console.error('❌ TEST FAILED with error:', error);
  }
}

// Run the test
testPraveenChatHistoryFix();