/**
 * Azure SQL Server to PostgreSQL Employee Sync
 * Power BI Style Direct Synchronization for ZohoID and Employee Name mappings
 */

import { azureEmployeeSync, type InsertAzureEmployeeSync } from "@shared/schema";
import { db } from "./db";
import { eq, sql, inArray } from "drizzle-orm";
interface AzureEmployee {
  ZohoID: string;
  FullName: string;
  IsActive?: boolean;
}

// Azure SQL connection configuration with provided credentials
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
 * Fetch all employees from Azure SQL Server using the existing table structure
 */
export async function fetchAzureEmployees(): Promise<AzureEmployee[]> {
  let pool: any = null;
  
  try {
    console.log('🔄 Connecting to Azure SQL Server for employee sync...');
    
    // Use dynamic import for mssql with default export
    const mssql = await import('mssql');
    
    // Create new connection pool instance
    pool = new mssql.default.ConnectionPool(azureConfig);
    await pool.connect();
    console.log('✅ Connected to Azure SQL Server successfully');
    
    // Query ALL employees from Azure SQL - complete dataset (4871 employees)
    const query = `
      SELECT 
        a.ZohoID AS [Zoho ID],
        a.FullName AS [Employee Name],
        1 as IsActive
      FROM RC_BI_Database.dbo.zoho_Employee a
      WHERE a.ZohoID IS NOT NULL 
        AND a.FullName IS NOT NULL
        AND LTRIM(RTRIM(a.ZohoID)) != ''
        AND LTRIM(RTRIM(a.FullName)) != ''
      ORDER BY a.FullName ASC
    `;
    
    const request = pool.request();
    const result = await request.query(query);
    console.log(`✅ Fetched ${result.recordset.length} employees from Azure SQL (zoho_Employee table)`);
    
    return result.recordset.map(row => ({
      ZohoID: row['Zoho ID'].toString().trim(),
      FullName: row['Employee Name'].toString().trim(),
      IsActive: Boolean(row.IsActive),
    }));
    
  } catch (error) {
    console.error('❌ Error fetching from Azure SQL:', error);
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
 * Sync Azure employees to PostgreSQL azure_employee_sync table
 */
export async function syncAzureEmployeesToPostgres(): Promise<{
  inserted: number;
  updated: number;
  total: number;
  errors: number;
}> {
  console.log('🚀 Starting full Azure dataset sync (4871 employees)...');
  
  const azureEmployees = await fetchAzureEmployees();
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  console.log(`📊 Processing ${azureEmployees.length} employees from Azure SQL...`);
  
  // Process in larger batches for maximum speed
  const batchSize = 200;
  const bulkInserts: InsertAzureEmployeeSync[] = [];
  
  console.log(`🚀 SPEED MODE: Processing ${azureEmployees.length} employees in batches of ${batchSize}...`);
  
  for (let i = 0; i < azureEmployees.length; i += batchSize) {
    const batch = azureEmployees.slice(i, i + batchSize);
    const batchNumber = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(azureEmployees.length/batchSize);
    
    console.log(`⚡ SPEED BATCH ${batchNumber}/${totalBatches}: Processing ${batch.length} employees...`);
    
    // Process each employee individually to avoid array issues
    for (const azureEmployee of batch) {
      try {
        // Check if employee already exists
        const existingEmployee = await db
          .select({ zohoId: azureEmployeeSync.zohoId, employeeName: azureEmployeeSync.employeeName })
          .from(azureEmployeeSync)
          .where(eq(azureEmployeeSync.zohoId, azureEmployee.ZohoID))
          .limit(1);
        
        if (existingEmployee.length > 0) {
          // Update existing employee only if name changed
          if (existingEmployee[0].employeeName !== azureEmployee.FullName) {
            await db
              .update(azureEmployeeSync)
              .set({
                employeeName: azureEmployee.FullName,
                isActive: azureEmployee.IsActive ?? true,
                lastSyncTimestamp: new Date(),
              })
              .where(eq(azureEmployeeSync.zohoId, azureEmployee.ZohoID));
            updated++;
          }
        } else {
          // Queue for bulk insert
          bulkInserts.push({
            zohoId: azureEmployee.ZohoID,
            employeeName: azureEmployee.FullName,
            isActive: azureEmployee.IsActive ?? true,
            lastSyncTimestamp: new Date(),
          });
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing employee ${azureEmployee.FullName}:`, error);
      }
    }
    
    // Bulk insert new employees every 500 records
    if (bulkInserts.length >= 500) {
      console.log(`💾 BULK INSERT: Adding ${bulkInserts.length} new employees...`);
      await db.insert(azureEmployeeSync).values(bulkInserts);
      inserted += bulkInserts.length;
      console.log(`✅ SPEED PROGRESS: ${inserted} employees synced so far...`);
      bulkInserts.length = 0; // Clear array
    }
  }
  
  // Insert remaining employees
  if (bulkInserts.length > 0) {
    console.log(`💾 FINAL BULK INSERT: Adding ${bulkInserts.length} remaining employees...`);
    await db.insert(azureEmployeeSync).values(bulkInserts);
    inserted += bulkInserts.length;
  }
  
  const results = {
    inserted,
    updated,
    total: azureEmployees.length,
    errors,
  };
  
  console.log(`✅ Full Azure sync completed: ${inserted} inserted, ${updated} updated, ${errors} errors, ${results.total} total processed`);
  return results;
}

/**
 * Get employee name by ZohoID from synced data
 */
export async function getEmployeeNameByZohoId(zohoId: string): Promise<string | null> {
  try {
    const result = await db
      .select({ employeeName: azureEmployeeSync.employeeName })
      .from(azureEmployeeSync)
      .where(eq(azureEmployeeSync.zohoId, zohoId))
      .limit(1);
    
    return result.length > 0 ? result[0].employeeName : null;
  } catch (error) {
    console.error(`❌ Error getting employee name for ZohoID ${zohoId}:`, error);
    return null;
  }
}

/**
 * Get all synced employees
 */
export async function getAllSyncedEmployees() {
  try {
    return await db
      .select()
      .from(azureEmployeeSync)
      .where(eq(azureEmployeeSync.isActive, true))
      .orderBy(azureEmployeeSync.employeeName);
  } catch (error) {
    console.error('❌ Error getting all synced employees:', error);
    return [];
  }
}

/**
 * Manual sync trigger
 */
export async function triggerManualSync() {
  console.log('🔄 Manual Azure sync triggered...');
  return await syncAzureEmployeesToPostgres();
}

/**
 * Daily automated sync function
 * Checks if sync is needed and performs it more frequently for faster completion
 */
export async function performDailySync(): Promise<boolean> {
  try {
    // Check current sync coverage
    const currentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(azureEmployeeSync);
    
    const totalSynced = currentCount[0]?.count || 0;
    const targetEmployees = 4871;
    const coverage = (totalSynced / targetEmployees) * 100;
    
    console.log(`📊 SPEED SYNC CHECK: ${totalSynced}/${targetEmployees} employees (${coverage.toFixed(1)}% coverage)`);
    
    // If less than 90% coverage, continue aggressive syncing
    if (coverage < 90) {
      console.log('🚀 SPEED MODE: Coverage below 90% - triggering continuous sync...');
      await syncAzureEmployeesToPostgres();
      return true;
    }
    
    // Check when last sync was performed for normal daily sync
    const lastSync = await db
      .select({ lastSyncTimestamp: azureEmployeeSync.lastSyncTimestamp })
      .from(azureEmployeeSync)
      .orderBy(azureEmployeeSync.lastSyncTimestamp)
      .limit(1);
    
    const now = new Date();
    const lastSyncDate = lastSync.length > 0 ? new Date(lastSync[0].lastSyncTimestamp) : null;
    
    // If no sync or last sync was more than 22 hours ago, perform sync
    if (!lastSyncDate || (now.getTime() - lastSyncDate.getTime()) > (22 * 60 * 60 * 1000)) {
      console.log('🕐 Daily sync needed - performing full Azure sync...');
      await syncAzureEmployeesToPostgres();
      return true;
    } else {
      console.log(`✅ Sync complete: ${totalSynced} employees synced (${coverage.toFixed(1)}% coverage)`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error in daily sync check:', error);
    return false;
  }
}

/**
 * Get sync statistics for monitoring
 */
export async function getSyncStatistics() {
  try {
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(azureEmployeeSync);
    
    const recentSyncs = await db
      .select({
        zohoId: azureEmployeeSync.zohoId,
        employeeName: azureEmployeeSync.employeeName,
        lastSyncTimestamp: azureEmployeeSync.lastSyncTimestamp,
      })
      .from(azureEmployeeSync)
      .orderBy(azureEmployeeSync.lastSyncTimestamp)
      .limit(5);
    
    return {
      totalEmployees: totalCount[0]?.count || 0,
      recentSyncs,
      lastSyncTime: recentSyncs[0]?.lastSyncTimestamp || null,
    };
  } catch (error) {
    console.error('❌ Error getting sync statistics:', error);
    return null;
  }
}