import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const sessionId = localStorage.getItem('sessionId');
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (sessionId) {
    headers["x-session-id"] = sessionId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle array query keys properly
    let url = queryKey[0] as string;
    
    // If the second part of the query key is an object (filters), add them as URL params
    if (typeof queryKey[1] === 'object' && queryKey[1] !== null) {
      const params = new URLSearchParams();
      const filters = queryKey[1] as Record<string, any>;
      
      // Add each filter field to the URL params - handle arrays properly
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // For arrays, add each value separately or join them
            if (value.length > 0) {
              params.append(key, value.join(','));
            } else {
              params.append(key, '');
            }
          } else if (value !== '') {
            params.append(key, String(value));
          }
        }
      });
      
      // Add params to URL if there are any
      const paramString = params.toString();
      if (paramString) {
        url = `${url}?${paramString}`;
      }
      
      console.log('Fetching with URL:', url);
    }
    
    const sessionId = localStorage.getItem('sessionId');
    const headers: Record<string, string> = {};
    
    if (sessionId) {
      headers["x-session-id"] = sessionId;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Force refetch to eliminate phantom cache
      staleTime: 0, // Always consider data stale to force fresh fetches
      gcTime: 0, // No cache retention to prevent phantom data
      retry: false,
    },
    mutations: {
      retry: false,
      // Immediately invalidate chat message queries after any mutation
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['/api/chat-messages'],
          exact: false
        });
      }
    },
  },
});

// Global chat message refresh function for bulletproof persistence
export const forceRefreshAllChatMessages = async () => {
  console.log('🔄 FORCING REFRESH: All chat message queries');
  await queryClient.invalidateQueries({
    queryKey: ['/api/chat-messages'],
    exact: false
  });
  await queryClient.refetchQueries({
    queryKey: ['/api/chat-messages'],
    exact: false
  });
};

// Global employee data refresh function to fix phantom display issues
export const forceRefreshEmployeeData = async () => {
  console.log('🔄 FORCING REFRESH: Employee data cache while preserving authentication');
  
  // Step 1: Preserve authentication data before clearing cache
  let sessionId = null;
  if (typeof window !== 'undefined') {
    console.log('🔐 Preserving authentication session...');
    try {
      sessionId = localStorage.getItem('sessionId');
      
      // Clear non-authentication related storage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== 'sessionId') {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear session storage (doesn't contain auth)
      sessionStorage.clear();
      
      // Clear employee-related IndexedDB only
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('EmployeeCache');
        indexedDB.deleteDatabase('QueryClientCache');
      }
    } catch (error) {
      console.log('Storage clearing error:', error);
    }
  }
  
  // Step 2: Clear only employee-related React Query cache
  console.log('🧹 Clearing employee data cache...');
  queryClient.removeQueries({
    queryKey: ['/api/employees'],
    exact: false
  });
  queryClient.removeQueries({
    queryKey: ['/api/chat-messages'],
    exact: false
  });
  queryClient.removeQueries({
    queryKey: ['/api/filter-options'],
    exact: false
  });
  
  // Step 3: Restore authentication session
  if (sessionId && typeof window !== 'undefined') {
    console.log('🔐 Restoring authentication session...');
    localStorage.setItem('sessionId', sessionId);
  }
  
  // Step 4: Force invalidate and refetch employee queries only
  await queryClient.invalidateQueries({
    queryKey: ['/api/employees'],
    exact: false
  });
  
  await queryClient.invalidateQueries({
    queryKey: ['/api/filter-options'],
    exact: false
  });
  
  // Step 5: Force refetch fresh data with cache busting
  await queryClient.refetchQueries({
    queryKey: ['/api/employees'],
    exact: false
  });
  
  console.log('✅ REFRESH COMPLETE: Employee data refreshed while preserving authentication');
};

// Setup global listeners for enhanced persistence
if (typeof window !== 'undefined') {
  // Force refresh on page visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('🔄 Page became visible - forcing chat refresh');
      forceRefreshAllChatMessages();
    }
  });

  // Force refresh on browser focus
  window.addEventListener('focus', () => {
    console.log('🔄 Window focused - forcing chat refresh');
    forceRefreshAllChatMessages();
  });

  // Force refresh on network reconnection
  window.addEventListener('online', () => {
    console.log('🔄 Network reconnected - forcing chat refresh');
    forceRefreshAllChatMessages();
  });

  // Periodic forced refresh every 30 seconds as safety net
  setInterval(() => {
    console.log('🔄 Periodic safety refresh - forcing chat refresh');
    forceRefreshAllChatMessages();
  }, 30000);
}
