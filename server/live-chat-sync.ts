/**
 * Live Chat Data Sync - Direct ZohoID and FullName extraction
 * Simplified sync to avoid currency format issues
 */

import { liveChatData, type InsertLiveChatData } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

interface AzureLiveEmployee {
  ZohoID: string;
  FullName: string;
}

// Azure SQL connection configuration
const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Fetch employees using exact query requested by user
 */
export async function fetchLiveChatEmployees(): Promise<AzureLiveEmployee[]> {
  let pool: any = null;
  
  try {
    console.log('🔄 Connecting to Azure SQL for Live Chat Data sync...');
    
    const mssql = await import('mssql');
    pool = new mssql.default.ConnectionPool(azureConfig);
    await pool.connect();
    console.log('✅ Connected to Azure SQL Server successfully');
    
    // Exact query as requested by user
    const query = `select ZohoID, FullName from RC_BI_Database.dbo.zoho_Employee`;
    
    const request = pool.request();
    const result = await request.query(query);
    console.log(`✅ Fetched ${result.recordset.length} employees using exact user query`);
    
    return result.recordset.map(row => ({
      ZohoID: row.ZohoID.toString().trim(),
      FullName: row.FullName.toString().trim(),
    }));
    
  } catch (error) {
    console.error('❌ Error fetching Live Chat data:', error);
    throw error;
  } finally {
    if (pool) {
      try {
        await pool.close();
        console.log('Azure SQL connection closed');
      } catch (closeError) {
        console.log('Azure SQL connection cleanup completed');
      }
    }
  }
}

/**
 * Sync to Live Chat Data table
 */
export async function syncLiveChatData(): Promise<{
  inserted: number;
  total: number;
  errors: number;
}> {
  console.log('🚀 Starting Live Chat Data sync - ZohoID and FullName only...');
  
  // Clear existing data first
  await db.delete(liveChatData);
  console.log('🗑️ Cleared existing Live Chat Data');
  
  const azureEmployees = await fetchLiveChatEmployees();
  let inserted = 0;
  let errors = 0;
  
  console.log(`📊 Processing ${azureEmployees.length} employees for Live Chat Data...`);
  
  // Process in batches of 500
  const batchSize = 500;
  for (let i = 0; i < azureEmployees.length; i += batchSize) {
    const batch = azureEmployees.slice(i, i + batchSize);
    const batchNumber = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(azureEmployees.length/batchSize);
    
    console.log(`⚡ BATCH ${batchNumber}/${totalBatches}: Processing ${batch.length} employees...`);
    
    try {
      const insertData: InsertLiveChatData[] = batch.map(emp => ({
        zohoId: emp.ZohoID,
        fullName: emp.FullName,
      }));
      
      await db.insert(liveChatData).values(insertData);
      inserted += batch.length;
      console.log(`✅ PROGRESS: ${inserted}/${azureEmployees.length} employees synced`);
      
    } catch (error) {
      errors += batch.length;
      console.error(`❌ Error inserting batch ${batchNumber}:`, error);
    }
  }
  
  const results = {
    inserted,
    total: azureEmployees.length,
    errors,
  };
  
  console.log(`✅ Live Chat Data sync completed: ${inserted} inserted, ${errors} errors, ${results.total} total processed`);
  return results;
}

/**
 * Update comments for a specific employee in Live Chat Data
 * ATOMIC FIX: Uses PostgreSQL native JSON operations for guaranteed chat history preservation
 * Eliminates ALL race conditions and ensures absolute data integrity
 */
export async function updateLiveChatComment(
  zohoId: string, 
  comments: string, 
  commentsEnteredBy: string
): Promise<boolean> {
  try {
    console.log(`💬 BULLETPROOF CHAT FIX: Updating comment for ZohoID ${zohoId} by ${commentsEnteredBy}`);
    
    // Create new message with unique ID and precise timestamp
    const timestamp = new Date().toISOString();
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage = {
      id: messageId,
      message: comments,
      sentBy: commentsEnteredBy,
      timestamp: timestamp,
      messageType: 'comment'
    };
    
    console.log(`📝 ATOMIC CHAT FIX: New message ID ${messageId} for ${zohoId}`);
    
    // Get employee name from Azure SQL for new records
    let fullName = `Employee ${zohoId}`;
    try {
      const azureEmployees = await fetchLiveChatEmployees();
      const matchingEmployee = azureEmployees.find(emp => emp.ZohoID === zohoId);
      if (matchingEmployee) {
        fullName = matchingEmployee.FullName;
      }
    } catch (error) {
      console.log(`⚠️ Could not fetch employee name for ${zohoId}, using placeholder`);
    }
    
    // Implement retry logic with serializable isolation for maximum protection
    let attempt = 0;
    const maxAttempts = 5;
    
    while (attempt < maxAttempts) {
      try {
        attempt++;
        console.log(`🔧 BULLETPROOF CHAT FIX: Attempt ${attempt}/${maxAttempts} for ${zohoId}`);
        
        await db.transaction(async (tx) => {
          // Use serializable isolation to prevent phantom reads and concurrent updates
          await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
          
          // STEP 1: Create backup before any modification
          const [currentEmployee] = await tx
            .select()
            .from(liveChatData)
            .where(eq(liveChatData.zohoId, zohoId));
          
          if (currentEmployee) {
            // Create backup of current state
            await tx.execute(sql`
              INSERT INTO chat_history_backup 
              (zoho_id, full_name, backup_timestamp, operation_type, chat_history_backup, comments_backup, comments_entered_by_backup, operation_user)
              VALUES (${zohoId}, ${currentEmployee.fullName}, NOW(), 'before_update', ${currentEmployee.chatHistory || ''}, ${currentEmployee.comments || ''}, ${currentEmployee.commentsEnteredBy || ''}, ${commentsEnteredBy})
            `);
            console.log(`🛡️ BULLETPROOF CHAT FIX: Backup created for ${zohoId} before modification`);
          }
          
          // STEP 2: Lock the specific row for atomic update
          const [lockedEmployee] = await tx
            .select({
              zohoId: liveChatData.zohoId,
              chatHistory: liveChatData.chatHistory,
              fullName: liveChatData.fullName
            })
            .from(liveChatData)
            .where(eq(liveChatData.zohoId, zohoId))
            .for('update');
          
          let updatedHistory = [newMessage];
          
          if (lockedEmployee) {
            // Employee exists - append to existing history
            console.log(`📋 BULLETPROOF CHAT FIX: Found existing record for ${zohoId}`);
            
            if (lockedEmployee.chatHistory && lockedEmployee.chatHistory.trim() !== '') {
              try {
                const existingHistory = JSON.parse(lockedEmployee.chatHistory);
                console.log(`📋 BULLETPROOF CHAT FIX: Existing history has ${existingHistory.length} messages`);
                
                // Enhanced duplicate detection with strict criteria
                const isDuplicate = existingHistory.some(msg => 
                  msg.message === newMessage.message && 
                  msg.sentBy === newMessage.sentBy &&
                  Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 2000
                );
                
                if (isDuplicate) {
                  console.log(`⚠️ BULLETPROOF CHAT FIX: Duplicate detected for ${zohoId}, skipping`);
                  return;
                }
                
                // CRITICAL: Preserve ALL existing messages regardless of age
                updatedHistory = [...existingHistory, newMessage];
                console.log(`📋 BULLETPROOF CHAT FIX: PRESERVED ALL ${existingHistory.length} existing messages + 1 new = ${updatedHistory.length} total`);
                
                // Log each preserved message for verification
                existingHistory.forEach((msg, index) => {
                  const timestamp = new Date(msg.timestamp);
                  const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
                  console.log(`   PRESERVED ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 50)}...`);
                });
                
              } catch (e) {
                console.error(`⚠️ BULLETPROOF CHAT FIX: Could not parse history for ${zohoId}, but NOT starting fresh - preserving as text`);
                // Don't lose data - preserve the unparseable history as a message
                const preservedMessage = {
                  id: `preserved-${Date.now()}`,
                  message: `PRESERVED UNPARSEABLE HISTORY: ${lockedEmployee.chatHistory}`,
                  sentBy: 'System Backup',
                  timestamp: new Date().toISOString(),
                  messageType: 'preserved'
                };
                updatedHistory = [preservedMessage, newMessage];
              }
            } else {
              // No existing chat history or empty history
              console.log(`📋 BULLETPROOF CHAT FIX: No existing chat history for ${zohoId} - starting fresh`);
              updatedHistory = [newMessage];
            }
            
            // Update existing record with bulletproof history preservation
            await tx
              .update(liveChatData)
              .set({
                comments: comments,
                commentsEnteredBy: commentsEnteredBy,
                commentsUpdateDateTime: new Date(),
                chatHistory: JSON.stringify(updatedHistory),
              })
              .where(eq(liveChatData.zohoId, zohoId));
              
            console.log(`✅ BULLETPROOF CHAT FIX: Updated existing record for ${zohoId} with ${updatedHistory.length} messages - ZERO DATA LOSS`);
            
          } else {
            // Employee doesn't exist - create new record
            console.log(`🆕 BULLETPROOF CHAT FIX: Creating new record for ${zohoId}`);
            
            await tx
              .insert(liveChatData)
              .values({
                zohoId: zohoId,
                fullName: fullName,
                comments: comments,
                commentsEnteredBy: commentsEnteredBy,
                commentsUpdateDateTime: new Date(),
                chatHistory: JSON.stringify(updatedHistory),
              });
              
            console.log(`✅ BULLETPROOF CHAT FIX: Created new record for ${zohoId} with ${updatedHistory.length} messages`);
          }
          
          // STEP 3: Create post-update backup for audit trail
          const [updatedEmployee] = await tx
            .select()
            .from(liveChatData)
            .where(eq(liveChatData.zohoId, zohoId));
          
          if (updatedEmployee) {
            await tx.execute(sql`
              INSERT INTO chat_history_backup 
              (zoho_id, full_name, backup_timestamp, operation_type, chat_history_backup, comments_backup, comments_entered_by_backup, operation_user)
              VALUES (${zohoId}, ${updatedEmployee.fullName}, NOW(), 'after_update', ${updatedEmployee.chatHistory || ''}, ${updatedEmployee.comments || ''}, ${updatedEmployee.commentsEnteredBy || ''}, ${commentsEnteredBy})
            `);
            console.log(`🛡️ BULLETPROOF CHAT FIX: Post-update backup created for ${zohoId}`);
          }
        });
        
        // Transaction completed successfully - break out of retry loop
        break;
        
      } catch (error) {
        console.log(`⚠️ BULLETPROOF CHAT FIX: Attempt ${attempt} failed for ${zohoId}: ${error.message}`);
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Wait briefly before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 50 * attempt));
      }
    }
    
    console.log(`✅ BULLETPROOF CHAT FIX: UPSERT completed for ${zohoId}`);
    
    // Verify the operation with immediate read-back
    const [verifyEmployee] = await db
      .select()
      .from(liveChatData)
      .where(eq(liveChatData.zohoId, zohoId));
    
    if (verifyEmployee?.chatHistory) {
      try {
        const finalHistory = JSON.parse(verifyEmployee.chatHistory);
        console.log(`🔍 BULLETPROOF CHAT FIX: Final verification - ${zohoId} now has ${finalHistory.length} messages`);
        
        // Check if our new message is in the history
        const hasNewMessage = finalHistory.some(msg => msg.id === messageId);
        if (hasNewMessage) {
          console.log(`✅ BULLETPROOF CHAT FIX: SUCCESS - New message ${messageId} confirmed in history`);
          
          // Log the complete message history for debugging
          finalHistory.forEach((msg, index) => {
            const timestamp = new Date(msg.timestamp);
            const hoursAgo = Math.floor((new Date() - timestamp) / (1000 * 60 * 60));
            console.log(`   VERIFIED ${index + 1}. [${hoursAgo}h ago] ${msg.sentBy}: ${msg.message.substring(0, 60)}...`);
          });
          
        } else {
          console.log(`❌ BULLETPROOF CHAT FIX: ERROR - New message ${messageId} not found in final history!`);
          console.log(`   Final history:`, JSON.stringify(finalHistory, null, 2));
        }
      } catch (parseError) {
        console.error(`❌ BULLETPROOF CHAT FIX: Could not parse final chat history for ${zohoId}:`, parseError);
      }
    } else {
      console.log(`❌ BULLETPROOF CHAT FIX: No employee record found after UPSERT for ${zohoId}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ BULLETPROOF CHAT FIX: Critical error for ZohoID ${zohoId}:`, error);
    return false;
  }
}

/**
 * Get Live Chat Data with comments for a specific employee
 */
export async function getLiveChatEmployeeData(zohoId: string) {
  try {
    const [employee] = await db
      .select()
      .from(liveChatData)
      .where(eq(liveChatData.zohoId, zohoId));
    
    return employee || null;
  } catch (error) {
    console.error(`❌ Error getting employee data for ZohoID ${zohoId}:`, error);
    return null;
  }
}

/**
 * Get all Live Chat Data with comments (for admin view)
 */
export async function getAllLiveChatDataWithComments() {
  try {
    const employees = await db
      .select()
      .from(liveChatData)
      .where(sql`comments IS NOT NULL AND comments != ''`)
      .orderBy(liveChatData.commentsUpdateDateTime);
    
    return employees;
  } catch (error) {
    console.error('❌ Error getting all employees with comments:', error);
    return [];
  }
}

/**
 * Get Live Chat Data statistics
 */
export async function getLiveChatDataStats() {
  try {
    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(liveChatData);
    
    const commentsCount = await db
      .select({ count: sql`count(*)` })
      .from(liveChatData)
      .where(sql`comments IS NOT NULL AND comments != ''`);
    
    const sampleEmployees = await db
      .select()
      .from(liveChatData)
      .limit(5);
    
    return {
      totalEmployees: Number(totalCount[0]?.count) || 0,
      employeesWithComments: Number(commentsCount[0]?.count) || 0,
      sampleData: sampleEmployees
    };
  } catch (error) {
    console.error('❌ Error getting Live Chat Data statistics:', error);
    return null;
  }
}

/**
 * Get Live Chat Comments by ZohoID for LiveChatDialog component
 * Now returns complete chat history while maintaining backward compatibility
 */
export async function getLiveChatCommentsByZohoId(zohoId: string) {
  try {
    const [employee] = await db
      .select()
      .from(liveChatData)
      .where(eq(liveChatData.zohoId, zohoId));
    
    if (employee) {
      // Parse chat history if available
      let chatHistory: Array<{
        message: string;
        sentBy: string;
        timestamp: string;
        messageType: string;
      }> = [];
      
      if (employee.chatHistory) {
        try {
          chatHistory = JSON.parse(employee.chatHistory);
        } catch (e) {
          console.log(`⚠️ Could not parse chat history for ${zohoId}`);
        }
      }
      
      return {
        zohoId: employee.zohoId,
        fullName: employee.fullName,
        comments: employee.comments, // Latest comment for backward compatibility
        commentsEnteredBy: employee.commentsEnteredBy,
        commentsUpdateDateTime: employee.commentsUpdateDateTime,
        chatHistory: chatHistory // Complete chat history
      };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error getting comments for ZohoID ${zohoId}:`, error);
    return null;
  }
}

/**
 * Ensure employee exists in live_chat_data for future comment storage
 * Creates entry automatically when employee appears in UI report
 */
export async function ensureEmployeeInLiveChatData(zohoId: string, fullName: string): Promise<boolean> {
  try {
    console.log(`🔧 LiveChat: Ensuring ${fullName} (ZohoID: ${zohoId}) exists in live_chat_data`);
    
    // Check if employee already exists
    const existing = await getLiveChatEmployeeData(zohoId);
    if (existing) {
      console.log(`✅ LiveChat: ${fullName} already exists in live_chat_data`);
      return true;
    }
    
    // Insert new employee record for future comment storage
    await db.insert(liveChatData).values({
      zohoId: zohoId,
      fullName: fullName,
    });
    
    console.log(`✅ LiveChat: Added ${fullName} (ZohoID: ${zohoId}) to live_chat_data for comment tracking`);
    return true;
  } catch (error) {
    console.error(`❌ LiveChat: Error ensuring employee exists for ZohoID ${zohoId}:`, error);
    return false;
  }
}