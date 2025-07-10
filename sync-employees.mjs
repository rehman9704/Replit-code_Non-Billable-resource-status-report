/**
 * Employee Data Synchronization Script
 * Syncs employee data from Azure SQL to PostgreSQL
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import required dependencies
import sql from 'mssql';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { employees } from './shared/schema.js';

const azureConfig = {
  server: 'rcdw01.public.cb9870f52d7f.database.windows.net',
  port: 3342,
  database: 'RC_BI_Database',
  user: 'rcdwadmin',
  password: 'RcDatabaseAdmin2@',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// PostgreSQL connection
const postgresClient = neon(process.env.DATABASE_URL);
const db = drizzle(postgresClient);

async function syncEmployees() {
  console.log('🔄 Starting employee data synchronization from Azure SQL to PostgreSQL...');
  
  try {
    // Connect to Azure SQL
    console.log('📡 Connecting to Azure SQL...');
    const pool = await sql.connect(azureConfig);
    
    // Run the full employee query to get data in the same format as the API
    const query = `
      WITH EmployeeTimesheetSummary AS (
        SELECT 
            UserName,
            MAX(Date) AS LastTimesheetDate,
            MAX(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) > 0 THEN Date END) AS LastValidBillableDate,
            MAX(CASE WHEN BillableStatus = 'Non-Billable' THEN Date END) AS LastNonBillableDate,
            COUNT(CASE WHEN BillableStatus = 'Non-Billable' THEN 1 END) AS NonBillableCount,
            COUNT(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) = 0 THEN 1 END) AS ZeroBillableCount,
            COUNT(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) > 0 THEN 1 END) AS ValidBillableCount,
            DATEDIFF(DAY, MAX(Date), GETDATE()) AS DaysSinceLastTimesheet,
            DATEDIFF(DAY, MAX(CASE WHEN BillableStatus = 'Billable' AND TRY_CONVERT(FLOAT, Hours) > 0 THEN Date END), GETDATE()) AS DaysSinceLastValidBillable,
            DATEDIFF(DAY, MIN(CASE WHEN BillableStatus = 'Non-Billable' THEN Date END), GETDATE()) AS TotalNonBillableDays
        FROM RC_BI_Database.dbo.zoho_TimeLogs
        WHERE Date >= DATEADD(MONTH, -6, GETDATE())
        GROUP BY UserName
      ),
      MixedUtilizationCheck AS (
        SELECT DISTINCT ets.UserName
        FROM EmployeeTimesheetSummary ets
        WHERE ets.LastTimesheetDate IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM RC_BI_Database.dbo.zoho_TimeLogs t1
            WHERE t1.UserName = ets.UserName 
              AND t1.Date = ets.LastTimesheetDate
              AND t1.BillableStatus = 'Billable'
          )
          AND EXISTS (
            SELECT 1 FROM RC_BI_Database.dbo.zoho_TimeLogs t2
            WHERE t2.UserName = ets.UserName 
              AND t2.Date = ets.LastTimesheetDate
              AND t2.BillableStatus = 'Non-Billable'
          )
      ),
      NonBillableAgingData AS (
        SELECT 
            ets.UserName,
            CASE 
              WHEN muc.UserName IS NOT NULL THEN 'Mixed Utilization'
              WHEN ets.LastValidBillableDate IS NOT NULL THEN
                CASE 
                  WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 10 THEN 'Non-Billable ≤10 days'
                  WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 30 THEN 'Non-Billable >10 days'
                  WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 60 THEN 'Non-Billable >30 days'
                  WHEN DATEDIFF(DAY, ets.LastValidBillableDate, GETDATE()) <= 90 THEN 'Non-Billable >60 days'
                  ELSE 'Non-Billable >90 days'
                END
              WHEN ets.LastNonBillableDate IS NOT NULL AND ets.ValidBillableCount = 0 THEN
                CASE 
                  WHEN ets.TotalNonBillableDays <= 10 THEN 'Non-Billable ≤10 days'
                  WHEN ets.TotalNonBillableDays <= 30 THEN 'Non-Billable >10 days'
                  WHEN ets.TotalNonBillableDays <= 60 THEN 'Non-Billable >30 days'
                  WHEN ets.TotalNonBillableDays <= 90 THEN 'Non-Billable >60 days'
                  ELSE 'Non-Billable >90 days'
                END
              ELSE 'Not Non-Billable'
            END AS NonBillableAging
        FROM EmployeeTimesheetSummary ets
        LEFT JOIN MixedUtilizationCheck muc ON ets.UserName = muc.UserName
      )
      SELECT TOP 1000
          a.ZohoID AS [Employee Number],
          a.FullName AS [Employee Name],
          loc.LocationName AS [Location],
          a.[CostPerMonth(USD)] AS [Cost (USD)],
          d.DepartmentName AS [Department Name],
          a.BusinessUnit AS [Business Unit],
          MIN(cl_new.ClientName) AS [Client Name_Security],
          STRING_AGG(
              CASE 
                  WHEN ftl.Date IS NULL OR DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 
                  THEN '' 
                  ELSE COALESCE(pr_new.ProjectName, 'No Project') 
              END, ' | '
          ) AS [Project Name], 
          STRING_AGG(
              CASE 
                  WHEN ftl.Date IS NULL OR DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 
                  THEN '' 
                  ELSE COALESCE(cl_new.ClientName, 'No Client') 
              END, ' | '
          ) AS [Client Name],
          STRING_AGG(
              CASE 
                  WHEN ftl.Date IS NULL THEN 'No timesheet filled'  
                  WHEN DATEDIFF(DAY, ftl.Date, GETDATE()) > 10 THEN 'No timesheet filled'  
                  ELSE COALESCE(ftl.BillableStatus, 'Billable')  
              END, ' | '
          ) AS [BillableStatus],
          COALESCE(nba.NonBillableAging, 'Not Non-Billable') AS [NonBillableAging],
          SUM(COALESCE(ftl.total_hours, 0)) AS [Total Logged Hours],
          MAX(CAST(ftl.Date AS DATE)) AS [Last updated timesheet date],
          COALESCE(bh.LastMonthBillableHours, 0) AS [Last month logged Billable hours],
          COALESCE(nb.LastMonthNonBillableHours, 0) AS [Last month logged Non Billable hours]
      FROM RC_BI_Database.dbo.zoho_Employee a
      LEFT JOIN RC_BI_Database.dbo.zoho_Location loc ON a.LocationID = loc.LocationID 
      LEFT JOIN RC_BI_Database.dbo.zoho_Department d ON a.DepartmentID = d.DepartmentID 
      LEFT JOIN NonBillableAgingData nba ON a.ID = nba.UserName
      LEFT JOIN (
          SELECT ztl.UserName, ztl.JobName, ztl.Project, ztl.Date, ztl.BillableStatus,  
                 SUM(TRY_CONVERT(FLOAT, ztl.hours)) AS total_hours  
          FROM RC_BI_Database.dbo.zoho_TimeLogs ztl
          INNER JOIN (
              SELECT UserName, MAX(Date) AS LastLoggedDate  
              FROM RC_BI_Database.dbo.zoho_TimeLogs
              GROUP BY UserName
          ) lt ON ztl.UserName = lt.UserName AND ztl.Date = lt.LastLoggedDate
          WHERE TRY_CONVERT(FLOAT, ztl.hours) IS NOT NULL  
          GROUP BY ztl.UserName, ztl.JobName, ztl.Project, ztl.Date, ztl.BillableStatus
      ) ftl ON a.ID = ftl.UserName 
      LEFT JOIN RC_BI_Database.dbo.zoho_Project pr_new ON ftl.Project = pr_new.ProjectID
      LEFT JOIN RC_BI_Database.dbo.zoho_Client cl_new ON pr_new.ClientID = cl_new.ClientID
      LEFT JOIN (
          SELECT UserName, 
                 SUM(TRY_CONVERT(FLOAT, Hours)) AS LastMonthBillableHours
          FROM RC_BI_Database.dbo.zoho_TimeLogs
          WHERE BillableStatus = 'Billable'
          AND Date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) - 1, 0)
          AND Date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          GROUP BY UserName
      ) bh ON a.ID = bh.UserName
      LEFT JOIN (
          SELECT UserName, 
                 SUM(TRY_CONVERT(FLOAT, Hours)) AS LastMonthNonBillableHours
          FROM RC_BI_Database.dbo.zoho_TimeLogs
          WHERE BillableStatus = 'Non-Billable'
          AND Date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) - 1, 0)
          AND Date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          GROUP BY UserName
      ) nb ON a.ID = nb.UserName
      WHERE a.Status = 'Active'
      GROUP BY 
          a.ZohoID, a.FullName, loc.LocationName, a.[CostPerMonth(USD)], 
          d.DepartmentName, a.BusinessUnit, nba.NonBillableAging
      ORDER BY a.FullName ASC;
    `;

    console.log('📊 Querying Azure SQL for employee data...');
    const result = await pool.request().query(query);
    const employees_data = result.recordset;
    
    console.log(`📊 Found ${employees_data.length} employees in Azure SQL`);

    // Clear existing PostgreSQL data
    console.log('🗑️ Clearing existing PostgreSQL employee data...');
    await db.delete(employees);

    // Insert employees in batches
    let syncCount = 0;
    for (const emp of employees_data) {
      try {
        const insertData = {
          name: emp['Employee Name'] || 'Unknown',
          zohoId: emp['Employee Number'] || 'Unknown',
          department: emp['Department Name'] || 'Unknown',
          location: emp['Location'] || 'Not Specified',
          billableStatus: emp['BillableStatus'] || 'No timesheet filled',
          businessUnit: emp['Business Unit'] || 'Unknown',
          client: emp['Client Name'] || emp['Client Name_Security'] || 'No Client',
          project: emp['Project Name'] || 'No Project',
          lastMonthBillable: parseFloat(emp['Last month logged Billable hours']) || 0,
          lastMonthBillableHours: parseFloat(emp['Last month logged Billable hours']) || 0,
          lastMonthNonBillableHours: parseFloat(emp['Last month logged Non Billable hours']) || 0,
          cost: parseFloat(emp['Cost (USD)']) || 0,
          comments: null,
          timesheetAging: 'Unknown',
          nonBillableAging: emp['NonBillableAging'] || 'Not Non-Billable',
        };

        await db.insert(employees).values(insertData);
        syncCount++;
      } catch (insertError) {
        console.log(`⚠️ Failed to sync employee ${emp['Employee Name']} (${emp['Employee Number']}):`, insertError.message);
      }
    }

    // Verify sync
    const pgEmployees = await db.select().from(employees);
    console.log(`✅ Synchronization complete: ${pgEmployees.length} employees now in PostgreSQL`);
    console.log(`📊 Successfully synced: ${syncCount} employees`);

    await pool.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Employee synchronization failed:', error);
    process.exit(1);
  }
}

syncEmployees();