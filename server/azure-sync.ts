/**
 * Azure SQL Server to PostgreSQL Employee Sync
 * Power BI Style Direct Synchronization for ZohoID and Employee Name mappings
 */

import { azureEmployeeSync, type InsertAzureEmployeeSync } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import * as mssql from "mssql";

interface AzureEmployee {
  ZohoID: string;
  FullName: string;
  IsActive?: boolean;
}

// Azure SQL connection configuration with provided credentials
const azureConfig: mssql.config = {
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
  let pool: mssql.ConnectionPool | null = null;
  
  try {
    console.log('🔄 Connecting to Azure SQL Server for employee sync...');
    pool = await mssql.connect(azureConfig);
    
    // Use the exact table and field structure provided by user
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
    
    const result = await pool.request().query(query);
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
      await pool.close();
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
}> {
  console.log('🚀 Starting Azure to PostgreSQL employee sync...');
  
  const azureEmployees = await fetchAzureEmployees();
  let inserted = 0;
  let updated = 0;
  
  for (const azureEmployee of azureEmployees) {
    try {
      // Check if employee already exists
      const existing = await db
        .select()
        .from(azureEmployeeSync)
        .where(eq(azureEmployeeSync.zohoId, azureEmployee.ZohoID))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing employee
        await db
          .update(azureEmployeeSync)
          .set({
            employeeName: azureEmployee.FullName,
            isActive: azureEmployee.IsActive ?? true,
            lastSyncTimestamp: new Date(),
          })
          .where(eq(azureEmployeeSync.zohoId, azureEmployee.ZohoID));
        
        updated++;
        console.log(`🔄 Updated: ${azureEmployee.FullName} (${azureEmployee.ZohoID})`);
      } else {
        // Insert new employee
        const newEmployee: InsertAzureEmployeeSync = {
          zohoId: azureEmployee.ZohoID,
          employeeName: azureEmployee.FullName,
          isActive: azureEmployee.IsActive ?? true,
          lastSyncTimestamp: new Date(),
        };
        
        await db.insert(azureEmployeeSync).values(newEmployee);
        inserted++;
        console.log(`➕ Inserted: ${azureEmployee.FullName} (${azureEmployee.ZohoID})`);
      }
    } catch (error) {
      console.error(`❌ Error syncing employee ${azureEmployee.FullName}:`, error);
    }
  }
  
  const results = {
    inserted,
    updated,
    total: azureEmployees.length,
  };
  
  console.log(`✅ Azure sync completed: ${inserted} inserted, ${updated} updated, ${results.total} total`);
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