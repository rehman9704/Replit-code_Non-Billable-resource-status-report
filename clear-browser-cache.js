/**
 * COMPLETE FRONTEND CACHE CLEAR
 * Forces complete browser cache clear to fix "Abdullah Wasi" display issue
 */

console.log('🧹 CLEARING ALL BROWSER CACHE FOR FRONTEND FIX');

// Clear localStorage for all employees
if (typeof window !== 'undefined' && window.localStorage) {
  const keysToRemove = [];
  
  // Find all chat-related localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('lastViewed_') || key.includes('chat') || key.includes('message'))) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all chat-related keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`   Removed localStorage key: ${key}`);
  });
  
  console.log(`✅ Cleared ${keysToRemove.length} localStorage items`);
}

// Clear sessionStorage
if (typeof window !== 'undefined' && window.sessionStorage) {
  sessionStorage.clear();
  console.log('✅ Cleared sessionStorage');
}

// Force page reload to reinitialize all React components
if (typeof window !== 'undefined') {
  console.log('🔄 FORCING COMPLETE PAGE RELOAD...');
  window.location.reload(true);
}

console.log('✅ CACHE CLEAR COMPLETE');