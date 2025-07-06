/**
 * Clear Browser Cache to Fix Employee Name Display Issues
 * This script clears all browser storage and forces a complete refresh
 */

console.log('🔧 CLEARING BROWSER CACHE FOR EMPLOYEE NAME FIX');

// Clear localStorage
try {
  const localStorageKeys = Object.keys(localStorage);
  console.log(`Clearing ${localStorageKeys.length} localStorage items`);
  localStorage.clear();
  console.log('✅ localStorage cleared');
} catch (e) {
  console.log('⚠️ localStorage clear failed:', e);
}

// Clear sessionStorage
try {
  const sessionStorageKeys = Object.keys(sessionStorage);
  console.log(`Clearing ${sessionStorageKeys.length} sessionStorage items`);
  sessionStorage.clear();
  console.log('✅ sessionStorage cleared');
} catch (e) {
  console.log('⚠️ sessionStorage clear failed:', e);
}

// Clear all cookies
try {
  const cookies = document.cookie.split(";");
  console.log(`Clearing ${cookies.length} cookies`);
  
  cookies.forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  console.log('✅ Cookies cleared');
} catch (e) {
  console.log('⚠️ Cookie clear failed:', e);
}

// Clear IndexedDB databases
try {
  if ('indexedDB' in window) {
    indexedDB.databases().then(function(databases) {
      console.log(`Found ${databases.length} IndexedDB databases`);
      databases.forEach(function(db) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          console.log(`Deleted IndexedDB: ${db.name}`);
        }
      });
      console.log('✅ IndexedDB cleared');
    });
  }
} catch (e) {
  console.log('⚠️ IndexedDB clear failed:', e);
}

// Clear React Query cache if available
try {
  if (window.queryClient) {
    window.queryClient.clear();
    console.log('✅ React Query cache cleared');
  }
} catch (e) {
  console.log('⚠️ React Query cache clear failed:', e);
}

console.log('🎯 Cache clearing complete - reloading page...');

// Force a hard reload
setTimeout(() => {
  window.location.reload(true);
}, 1000);