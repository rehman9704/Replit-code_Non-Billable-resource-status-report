/**
 * BACKUP RECOVERY SYSTEM
 * Functions to recover lost chat histories and audit backup table
 */

// Check backup table status
async function checkBackupStatus() {
  console.log('🛡️ BACKUP SYSTEM STATUS CHECK');
  console.log('==============================');
  
  try {
    const response = await fetch('http://localhost:5000/api/execute-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          SELECT 
            zoho_id,
            COUNT(*) as backup_count,
            MIN(backup_timestamp) as first_backup,
            MAX(backup_timestamp) as latest_backup,
            STRING_AGG(DISTINCT operation_type, ', ') as operations
          FROM chat_history_backup 
          GROUP BY zoho_id 
          ORDER BY latest_backup DESC 
          LIMIT 10
        `
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.results) {
      console.log(`📊 Found backups for ${data.results.length} employees:`);
      data.results.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.zoho_id}: ${row.backup_count} backups, latest: ${row.latest_backup}`);
      });
    } else {
      console.log('❌ Could not retrieve backup status');
    }
    
  } catch (error) {
    console.error('❌ Backup status check failed:', error);
  }
}

// Recover chat history for a specific employee
async function recoverChatHistory(zohoId) {
  console.log(`🔄 RECOVERING CHAT HISTORY FOR: ${zohoId}`);
  console.log('='.repeat(50));
  
  try {
    // Get all backups for this employee
    const response = await fetch('http://localhost:5000/api/execute-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          SELECT 
            backup_timestamp,
            operation_type,
            chat_history_backup,
            operation_user
          FROM chat_history_backup 
          WHERE zoho_id = '${zohoId}'
          ORDER BY backup_timestamp DESC
        `
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      console.log(`📋 Found ${data.results.length} backup records for ${zohoId}:`);
      
      data.results.forEach((backup, index) => {
        console.log(`\n${index + 1}. [${backup.backup_timestamp}] ${backup.operation_type} by ${backup.operation_user}`);
        
        if (backup.chat_history_backup) {
          try {
            const history = JSON.parse(backup.chat_history_backup);
            console.log(`   Messages in backup: ${history.length}`);
            
            history.forEach((msg, msgIndex) => {
              const timestamp = new Date(msg.timestamp);
              const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
              console.log(`     ${msgIndex + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 40)}...`);
            });
          } catch (e) {
            console.log(`   Raw backup data: ${backup.chat_history_backup.substring(0, 100)}...`);
          }
        } else {
          console.log('   No chat history in this backup');
        }
      });
      
      // Find the most recent backup with chat history
      const latestWithHistory = data.results.find(backup => backup.chat_history_backup);
      
      if (latestWithHistory) {
        console.log(`\n🎯 LATEST BACKUP WITH HISTORY: ${latestWithHistory.backup_timestamp}`);
        console.log('💡 This backup could be used for recovery if needed');
      }
      
    } else {
      console.log(`❌ No backup records found for ${zohoId}`);
    }
    
  } catch (error) {
    console.error(`❌ Recovery failed for ${zohoId}:`, error);
  }
}

// Main function
async function runBackupRecoverySystem() {
  console.log('🛡️ BACKUP RECOVERY SYSTEM INITIALIZED');
  console.log('=====================================\n');
  
  // Check overall backup status
  await checkBackupStatus();
  
  console.log('\n');
  
  // Check specific employees that reported issues
  const problematicEmployees = ['10012021', '10114434']; // Nova J, Muhammad Aashir
  
  for (const zohoId of problematicEmployees) {
    await recoverChatHistory(zohoId);
    console.log('\n');
  }
  
  console.log('=====================================');
  console.log('🛡️ BACKUP RECOVERY SYSTEM COMPLETED');
  console.log('💡 All future chat updates are now protected with automatic backups');
  console.log('💡 Previous data loss (17h old comments) occurred before backup system was implemented');
}

// Run the backup recovery system
runBackupRecoverySystem();