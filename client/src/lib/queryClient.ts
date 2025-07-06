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
  console.log('🔄 FORCING REFRESH: Employee data to eliminate phantom names like "Abdullah Wasi"');
  
  // Step 1: Clear browser storage completely
  if (typeof window !== 'undefined') {
    console.log('🧹 Clearing browser storage...');
    try {
      localStorage.clear();
      sessionStorage.clear();
      // Clear indexedDB if it exists
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('QueryClientCache');
        indexedDB.deleteDatabase('EmployeeCache');
      }
    } catch (error) {
      console.log('Browser storage clearing error:', error);
    }
  }
  
  // Step 2: Clear ALL React Query cache
  console.log('🧹 Clearing React Query cache...');
  queryClient.clear();
  
  // Step 3: Reset query client state completely
  queryClient.removeQueries();
  
  // Step 4: Force invalidate all employee queries
  await queryClient.invalidateQueries({
    queryKey: ['/api/employees'],
    exact: false
  });
  
  // Step 5: Force refetch fresh data with cache busting
  const timestamp = Date.now();
  await queryClient.refetchQueries({
    queryKey: ['/api/employees'],
    exact: false
  });
  
  // Step 6: Page reload disabled to prevent infinite loops
  // setTimeout(() => {
  //   console.log('🔄 Forcing page reload to eliminate phantom cached names');
  //   if (typeof window !== 'undefined') {
  //     window.location.reload();
  //   }
  // }, 2000);
  
  console.log('✅ Employee data cache completely cleared and refreshed');
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
