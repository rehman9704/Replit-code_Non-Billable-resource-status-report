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
      refetchOnWindowFocus: false,
      staleTime: 0, // Always fetch fresh data
      gcTime: 0, // No cache retention
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
  
  // Clear ALL caches related to chat messages
  await queryClient.clear();
  
  // Invalidate all possible chat query patterns
  await queryClient.invalidateQueries({
    queryKey: ['/api/chat-messages'],
    exact: false
  });
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && (
        key.includes('chat-messages') || 
        key.includes('/api/chat-messages') ||
        key.includes('comment-chat')
      );
    }
  });
  
  // Force refetch with fresh requests
  await queryClient.refetchQueries({
    queryKey: ['/api/chat-messages'],
    exact: false
  });
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
