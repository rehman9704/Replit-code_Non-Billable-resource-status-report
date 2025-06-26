import sql from 'mssql';

async function debugNonBillableData() {
  try {
    const config = {
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    };

    console.log('Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    
    // Check if there are any Non-Billable records
    console.log('\n=== Checking for Non-Billable records ===');
    const nonBillableQuery = `
      SELECT TOP 10 UserName, BillableStatus, Date, Hours 
      FROM RC_BI_Database.dbo.zoho_TimeLogs 
      WHERE BillableStatus = 'Non-Billable'
      ORDER BY Date DESC
    `;
    const nonBillableResult = await pool.request().query(nonBillableQuery);
    console.log('Non-Billable records found:', nonBillableResult.recordset.length);
    console.log('Sample records:', nonBillableResult.recordset.slice(0, 3));
    
    // Check distinct BillableStatus values
    console.log('\n=== Checking distinct BillableStatus values ===');
    const distinctQuery = `
      SELECT DISTINCT BillableStatus, COUNT(*) as count
      FROM RC_BI_Database.dbo.zoho_TimeLogs 
      GROUP BY BillableStatus
      ORDER BY count DESC
    `;
    const distinctResult = await pool.request().query(distinctQuery);
    console.log('Distinct BillableStatus values:', distinctResult.recordset);
    
    // Check if any employees have Non-Billable records
    console.log('\n=== Checking employees with Non-Billable records ===');
    const employeeQuery = `
      SELECT DISTINCT ztl.UserName, a.FullName
      FROM RC_BI_Database.dbo.zoho_TimeLogs ztl
      INNER JOIN RC_BI_Database.dbo.zoho_Employee a ON ztl.UserName = a.ID
      WHERE ztl.BillableStatus = 'Non-Billable'
      ORDER BY a.FullName
    `;
    const employeeResult = await pool.request().query(employeeQuery);
    console.log('Employees with Non-Billable records:', employeeResult.recordset.length);
    console.log('Sample employees:', employeeResult.recordset.slice(0, 5));
    
    await pool.close();
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugNonBillableData();