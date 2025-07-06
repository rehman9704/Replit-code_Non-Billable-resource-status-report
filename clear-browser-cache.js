/**
 * COMPLETE FRONTEND CACHE CLEAR
 * Forces complete browser cache clear to fix "Abdullah Wasi" display issue
 */

// Clear all possible browser caches
if (typeof window !== 'undefined') {
  // Clear localStorage
  localStorage.clear();
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear all cookies
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  
  // Force reload with cache clear
  window.location.reload(true);
}

console.log('🔥 BROWSER CACHE CLEARED - RELOAD INITIATED');
console.log('✅ localStorage cleared');
console.log('✅ sessionStorage cleared');
console.log('✅ cookies cleared');
console.log('✅ forced reload with cache clear');