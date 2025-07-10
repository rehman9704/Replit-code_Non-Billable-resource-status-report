/**
 * SYNC POSTGRESQL WITH AZURE SQL - GET EXACTLY 215 EMPLOYEES
 * This script populates PostgreSQL with the exact employees from Azure SQL report
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function syncEmployeesFromAzure() {
  console.log('🔄 SYNCING POSTGRESQL WITH AZURE SQL DATA...');
  console.log('Target: Exactly 215 employees from the report');
  
  try {
    // Step 1: Fetch employees from the API (which comes from Azure SQL)
    console.log('\n📡 Step 1: Fetching employees from Azure SQL API...');
    const response = await fetch('http://localhost:5000/api/employees?pageSize=1000');
    const data = await response.json();
    
    console.log(`✅ Fetched ${data.employees.length} employees from Azure SQL`);
    console.log(`📊 Total rows reported: ${data.totalRows}`);
    
    if (data.employees.length === 0) {
      console.log('❌ No employees found - aborting sync');
      return;
    }
    
    // Step 2: Clear existing PostgreSQL data
    console.log('\n🗑️ Step 2: Clearing existing PostgreSQL data...');
    await pool.query('DELETE FROM employees');
    console.log('✅ PostgreSQL employees table cleared');
    
    // Step 3: Insert employees into PostgreSQL
    console.log('\n📥 Step 3: Inserting employees into PostgreSQL...');
    let insertCount = 0;
    
    for (const employee of data.employees) {
      try {
        const result = await pool.query(`
          INSERT INTO employees (
            id, zoho_id, name, department, location, billable_status,
            business_unit, client, project, last_month_billable,
            last_month_billable_hours, last_month_non_billable_hours,
            cost, comments, timesheet_aging, non_billable_aging
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          employee.id,
          employee.zohoId,
          employee.name,
          employee.department || '',
          employee.location || '',
          employee.billableStatus || 'Non-Billable',
          employee.businessUnit || '',
          employee.client || '',
          employee.project || '',
          employee.lastMonthBillable || '$0.00',
          employee.lastMonthBillableHours || '0',
          employee.lastMonthNonBillableHours || '0',
          employee.cost || '$0.00',
          employee.comments || '',
          employee.timesheetAging || 'No timesheet filled',
          employee.nonBillableAging || 'Not Non-Billable'
        ]);
        
        insertCount++;
        
        if (insertCount % 50 === 0) {
          console.log(`   ✅ Inserted ${insertCount} employees...`);
        }
        
      } catch (error) {
        console.error(`❌ Error inserting employee ${employee.name} (${employee.zohoId}):`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully inserted ${insertCount} employees into PostgreSQL`);
    
    // Step 4: Verify the sync
    console.log('\n🔍 Step 4: Verifying sync...');
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM employees');
    const postgresCount = verifyResult.rows[0].count;
    
    console.log(`📊 PostgreSQL employee count: ${postgresCount}`);
    console.log(`📊 Azure SQL employee count: ${data.employees.length}`);
    
    if (postgresCount == data.employees.length) {
      console.log('✅ SYNC SUCCESSFUL - Employee counts match!');
    } else {
      console.log('⚠️ SYNC WARNING - Employee counts do not match');
    }
    
    // Step 5: Show employee sample for verification
    console.log('\n📋 Step 5: Sample employees (first 10):');
    const sampleResult = await pool.query(`
      SELECT id, name, zoho_id 
      FROM employees 
      ORDER BY name ASC 
      LIMIT 10
    `);
    
    sampleResult.rows.forEach((emp, index) => {
      console.log(`   ${index + 1}. ${emp.name} (ID: ${emp.id}, ZohoID: ${emp.zoho_id})`);
    });
    
    console.log('\n🎯 POSTGRES-AZURE SYNC COMPLETE');
    console.log('💬 Chat comments will need to be restored manually');
    
  } catch (error) {
    console.error('❌ SYNC ERROR:', error);
  } finally {
    await pool.end();
  }
}

// Run the sync
syncEmployeesFromAzure();