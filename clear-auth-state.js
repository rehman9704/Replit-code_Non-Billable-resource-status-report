/**
 * Clear Authentication State to Fix Login Loop
 * Run this in browser console to clear authentication data
 */

console.log('🔧 CLEARING AUTHENTICATION STATE');

// Clear localStorage
try {
  localStorage.removeItem('sessionId');
  localStorage.removeItem('authToken');
  localStorage.removeItem('userSession');
  localStorage.clear();
  console.log('✅ localStorage cleared');
} catch (e) {
  console.log('⚠️ localStorage clear failed:', e);
}

// Clear sessionStorage
try {
  sessionStorage.clear();
  console.log('✅ sessionStorage cleared');
} catch (e) {
  console.log('⚠️ sessionStorage clear failed:', e);
}

// Clear cookies
try {
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  console.log('✅ Cookies cleared');
} catch (e) {
  console.log('⚠️ Cookie clear failed:', e);
}

console.log('🎯 Authentication state cleared - please refresh page and try login again');