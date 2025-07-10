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
 */
export async function updateLiveChatComment(
  zohoId: string, 
  comments: string, 
  commentsEnteredBy: string
): Promise<boolean> {
  try {
    console.log(`💬 Updating comment for ZohoID ${zohoId} by ${commentsEnteredBy}`);
    
    const result = await db
      .update(liveChatData)
      .set({
        comments: comments,
        commentsEnteredBy: commentsEnteredBy,
        commentsUpdateDateTime: new Date(),
      })
      .where(eq(liveChatData.zohoId, zohoId));
    
    console.log(`✅ Comment updated successfully for ZohoID ${zohoId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating comment for ZohoID ${zohoId}:`, error);
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
 */
export async function getLiveChatCommentsByZohoId(zohoId: string) {
  try {
    const [employee] = await db
      .select()
      .from(liveChatData)
      .where(eq(liveChatData.zohoId, zohoId));
    
    if (employee && employee.comments) {
      return {
        zohoId: employee.zohoId,
        fullName: employee.fullName,
        comments: employee.comments,
        commentsEnteredBy: employee.commentsEnteredBy,
        commentsUpdateDateTime: employee.commentsUpdateDateTime
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