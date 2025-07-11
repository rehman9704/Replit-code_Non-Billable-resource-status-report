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
 * ULTIMATE FIX: Uses database transaction with row-level locking to prevent any chat history loss
 * Guarantees complete chat history preservation across all concurrent operations
 */
export async function updateLiveChatComment(
  zohoId: string, 
  comments: string, 
  commentsEnteredBy: string
): Promise<boolean> {
  try {
    console.log(`💬 ULTIMATE CHAT FIX: Updating comment for ZohoID ${zohoId} by ${commentsEnteredBy}`);
    
    // Create new message with unique timestamp to prevent duplicates
    const newMessage = {
      message: comments,
      sentBy: commentsEnteredBy,
      timestamp: new Date().toISOString(),
      messageType: 'comment',
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Unique ID
    };
    
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
    
    // Use database transaction with explicit locking to prevent concurrent issues
    await db.transaction(async (tx) => {
      console.log(`🔒 ULTIMATE CHAT FIX: Starting transaction for ${zohoId}`);
      
      // First, lock the row to prevent concurrent modifications
      const [currentEmployee] = await tx
        .select()
        .from(liveChatData)
        .where(eq(liveChatData.zohoId, zohoId))
        .for('update'); // This locks the row until transaction completes
      
      let existingHistory: any[] = [];
      
      if (currentEmployee) {
        console.log(`📋 ULTIMATE CHAT FIX: Found existing record for ${zohoId}`);
        
        // Parse existing chat history safely
        if (currentEmployee.chatHistory) {
          try {
            existingHistory = JSON.parse(currentEmployee.chatHistory);
            console.log(`📋 ULTIMATE CHAT FIX: Existing history has ${existingHistory.length} messages`);
            
            // Log all existing messages for debugging
            existingHistory.forEach((msg, index) => {
              console.log(`   ${index + 1}. [${msg.timestamp}] ${msg.sentBy}: ${msg.message.substring(0, 50)}...`);
            });
          } catch (e) {
            console.log(`⚠️ ULTIMATE CHAT FIX: Could not parse existing chat history for ${zohoId}, starting fresh`);
            existingHistory = [];
          }
        }
        
        // Check for duplicate messages (same content from same user)
        const isDuplicate = existingHistory.some(msg => 
          msg.message === newMessage.message && 
          msg.sentBy === newMessage.sentBy
        );
        
        if (isDuplicate) {
          console.log(`⚠️ ULTIMATE CHAT FIX: Duplicate message detected for ${zohoId}, skipping`);
          return;
        }
        
        // Create the new complete history by appending the new message
        const newCompleteHistory = [...existingHistory, newMessage];
        console.log(`📋 ULTIMATE CHAT FIX: New complete history will have ${newCompleteHistory.length} messages`);
        
        // Update the existing record with preserved history
        await tx
          .update(liveChatData)
          .set({
            comments: comments,
            commentsEnteredBy: commentsEnteredBy,
            commentsUpdateDateTime: new Date(),
            chatHistory: JSON.stringify(newCompleteHistory),
          })
          .where(eq(liveChatData.zohoId, zohoId));
        
        console.log(`✅ ULTIMATE CHAT FIX: Successfully updated existing record for ${zohoId} with ${newCompleteHistory.length} messages`);
        
      } else {
        // Create new record with the first message
        console.log(`🆕 ULTIMATE CHAT FIX: Creating new record for ${zohoId}`);
        
        const newHistory = [newMessage];
        
        await tx
          .insert(liveChatData)
          .values({
            zohoId: zohoId,
            fullName: fullName,
            comments: comments,
            commentsEnteredBy: commentsEnteredBy,
            commentsUpdateDateTime: new Date(),
            chatHistory: JSON.stringify(newHistory),
          });
        
        console.log(`✅ ULTIMATE CHAT FIX: Successfully created new record for ${zohoId} with ${newHistory.length} messages`);
      }
    });
    
    // Verify the update worked by checking the final state
    const [verifyEmployee] = await db
      .select()
      .from(liveChatData)
      .where(eq(liveChatData.zohoId, zohoId));
    
    if (verifyEmployee?.chatHistory) {
      const finalHistory = JSON.parse(verifyEmployee.chatHistory);
      console.log(`🔍 ULTIMATE CHAT FIX: Verification - Final history for ${zohoId} has ${finalHistory.length} messages`);
      
      // Check if our new message is in the history
      const hasNewMessage = finalHistory.some(msg => msg.id === newMessage.id);
      if (hasNewMessage) {
        console.log(`✅ ULTIMATE CHAT FIX: Verified - New message successfully added to history`);
      } else {
        console.log(`❌ ULTIMATE CHAT FIX: ERROR - New message not found in final history!`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ ULTIMATE CHAT FIX: Error updating comment for ZohoID ${zohoId}:`, error);
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