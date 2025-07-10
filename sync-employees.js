/**
 * Employee Data Synchronization Script
 * Syncs employee data from Azure SQL to PostgreSQL
 */

import { storage } from './server/storage.js';

async function syncEmployees() {
  console.log('🔄 Starting employee data synchronization...');
  
  try {
    await storage.syncEmployeesToPostgreSQL();
    console.log('✅ Employee synchronization completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Employee synchronization failed:', error);
    process.exit(1);
  }
}

syncEmployees();