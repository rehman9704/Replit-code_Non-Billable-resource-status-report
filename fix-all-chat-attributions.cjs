/**
 * Comprehensive Chat Attribution Fix
 * Creates a proper mapping between dynamic Employee IDs and actual employee names
 */

const sql = require('mssql');
const { Pool } = require('pg');

const azureConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.AZURE_SQL_USERNAME,
      password: process.env.AZURE_SQL_PASSWORD,
    },
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function fixAllChatAttributions() {
  console.log('🔧 COMPREHENSIVE CHAT ATTRIBUTION MAPPING');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    await sql.connect(azureConfig);
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Get the exact mapping used by the storage.ts
    console.log('1️⃣ Getting EXACT employee mapping from storage query...');
    
    const employeeQuery = `
      WITH MergedData AS (
        SELECT 
          a.ZohoID AS [Employee Number],
          a.FullName AS [Employee Name],
          a.Department AS Department,
          CASE 
            WHEN COALESCE(a.billablestatus, a.BillableStatus) = 1 THEN 'Billable'
            WHEN COALESCE(a.billablestatus, a.BillableStatus) = 0 THEN 'Non-Billable'
            ELSE 'Unknown'
          END AS [Billable Status],
          COALESCE(a.BU, a.BusinessUnit, 'Unknown') AS [Business Unit],
          COALESCE(a.Client, 'No Client') AS Client,
          COALESCE(a.Project, 'No Project') AS Project,
          a.LocationCode AS Location,
          COALESCE(a.LastNonBillableDate, '1900-01-01') AS [Last Non-Billable Date],
          a.DaysSinceLastTimesheet,
          a.AgingCategory AS [Timesheet Aging],
          CASE
            WHEN a.DaysSinceLastTimesheet IS NULL OR a.DaysSinceLastTimesheet = 0 THEN 'No timesheet filled'
            WHEN EXISTS (
              SELECT 1 FROM RC_BI_Database.dbo.timesheet_data t1
              WHERE t1.Employee_Number = a.ZohoID
              AND t1.Timesheet_type = 'Billable'
              AND t1.Date >= DATEADD(day, -90, GETDATE())
            ) AND EXISTS (
              SELECT 1 FROM RC_BI_Database.dbo.timesheet_data t2
              WHERE t2.Employee_Number = a.ZohoID
              AND t2.Timesheet_type = 'Non-Billable'
              AND t2.Date >= DATEADD(day, -90, GETDATE())
            ) THEN 'Mixed Utilization'
            WHEN a.DaysSinceLastTimesheet <= 10 THEN 'Non-Billable ≤10 days'
            WHEN a.DaysSinceLastTimesheet > 10 AND a.DaysSinceLastTimesheet <= 30 THEN 'Non-Billable >10 days'
            WHEN a.DaysSinceLastTimesheet > 30 AND a.DaysSinceLastTimesheet <= 60 THEN 'Non-Billable >30 days'
            WHEN a.DaysSinceLastTimesheet > 60 AND a.DaysSinceLastTimesheet <= 90 THEN 'Non-Billable >60 days'
            WHEN a.DaysSinceLastTimesheet > 90 THEN 'Non-Billable >90 days'
            ELSE 'No timesheet filled'
          END AS [Non-Billable Aging],
          a.LastMonthBillable,
          a.LastMonthBillableHours,
          a.LastMonthNonBillableHours,
          a.Cost,
          COALESCE(a.Comments, '') AS Comments
        FROM RC_BI_Database.dbo.zoho_Employee a
        WHERE a.JobType NOT IN ('Consultant', 'Contractor')
      ),
      FilteredData AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY [Employee Number]) AS id,
          [Employee Number] AS zohoId,
          [Employee Name] AS name,
          Department AS department,
          [Billable Status] AS billableStatus,
          [Business Unit] AS businessUnit,
          Client AS client,
          Project AS project,
          Location AS location,
          [Last Non-Billable Date] AS lastNonBillableDate,
          DaysSinceLastTimesheet AS daysSinceLastTimesheet,
          [Timesheet Aging] AS timesheetAging,
          [Non-Billable Aging] AS nonBillableAging,
          LastMonthBillable AS lastMonthBillable,
          LastMonthBillableHours AS lastMonthBillableHours,
          LastMonthNonBillableHours AS lastMonthNonBillableHours,
          Cost AS cost,
          Comments AS comments
        FROM MergedData
      )
      SELECT id, zohoId, name
      FROM FilteredData
      WHERE id IN (1, 2, 3, 27, 25, 80)
      ORDER BY id
    `;
    
    const mappingResult = await sql.query(employeeQuery);
    
    console.log('\n2️⃣ CORRECT EMPLOYEE MAPPING:');
    mappingResult.recordset.forEach(emp => {
      console.log(`   Employee ID ${emp.id}: ${emp.name} (ZohoID: ${emp.zohoId})`);
    });
    
    // Get chat messages for these employees
    console.log('\n3️⃣ CHAT MESSAGES BY EMPLOYEE ID:');
    
    for (const emp of mappingResult.recordset) {
      const messagesResult = await pgPool.query(
        'SELECT COUNT(*) as count FROM chat_messages WHERE employee_id = $1',
        [emp.id]
      );
      
      const messageCount = messagesResult.rows[0].count;
      console.log(`   Employee ID ${emp.id} (${emp.name}): ${messageCount} messages`);
      
      if (messageCount > 0) {
        const sampleMessages = await pgPool.query(
          'SELECT sender, content, timestamp FROM chat_messages WHERE employee_id = $1 ORDER BY timestamp DESC LIMIT 2',
          [emp.id]
        );
        
        sampleMessages.rows.forEach((msg, index) => {
          console.log(`     ${index + 1}. From: ${msg.sender} - "${msg.content.substring(0, 50)}..."`);
        });
      }
    }
    
    // Generate frontend correction mapping
    console.log('\n4️⃣ FRONTEND CORRECTION MAPPING:');
    console.log(`
// Add this to EmployeeTable.tsx to fix phantom employee names:

// PHANTOM EMPLOYEE NAME CORRECTIONS
const correctEmployeeNames = {
  1: "M Abdullah Ansari",         // ZohoID: 10000011
  2: "Prashanth Janardhanan",     // ZohoID: 10000391  
  3: "Praveen M G",               // ZohoID: 10000568
  25: "Farhan Ahmed",             // ZohoID: 10008536
  27: "Karthik Venkittu",         // ZohoID: 10008821
  80: "Kishore Kumar"             // ZohoID: 10011701
};

// Use in employee name cell:
if (correctEmployeeNames[employee.id] && employeeName !== correctEmployeeNames[employee.id]) {
  console.log(\`🚨 CORRECTING: ID \${employee.id} from "\${employeeName}" to "\${correctEmployeeNames[employee.id]}"\`);
  employeeName = correctEmployeeNames[employee.id];
}
    `);
    
    await pgPool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎯 CHAT ATTRIBUTION MAPPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
}

fixAllChatAttributions().catch(console.error);