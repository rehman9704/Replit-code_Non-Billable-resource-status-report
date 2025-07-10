/**
 * Display Chat Comments in readable format
 */

const { neon } = require('@neondatabase/serverless');

const postgresClient = neon(process.env.DATABASE_URL);

async function showChatComments() {
  console.log('📊 All Chat Comments from Database:\n');
  
  try {
    const comments = await postgresClient(`
      SELECT 
        cci.intended_employee_name as employee_name,
        cci.intended_zoho_id as zoho_id, 
        cci.sender as entered_by,
        cci.content as comment_text,
        cci.created_at as date_entered
      FROM chat_comments_intended cci
      ORDER BY cci.created_at DESC
    `);

    console.log(`Found ${comments.length} total comments:\n`);
    console.log('=' * 80);

    comments.forEach((comment, index) => {
      console.log(`${index + 1}. Employee: ${comment.employee_name}`);
      console.log(`   Zoho ID: ${comment.zoho_id}`);
      console.log(`   Comment: "${comment.comment_text}"`);
      console.log(`   Entered by: ${comment.entered_by}`);
      console.log(`   Date/Time: ${new Date(comment.date_entered).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

showChatComments();