import { useCallback, useRef } from 'react';

interface RequestQueue {
  [key: string]: {
    timer: NodeJS.Timeout;
    promises: Array<{
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }>;
  };
}

// Hook to throttle API requests and batch them
export const useThrottledRequests = () => {
  const requestQueue = useRef<RequestQueue>({});
  const THROTTLE_DELAY = 50; // 50ms delay

  const throttledRequest = useCallback(async (url: string, options?: RequestInit) => {
    return new Promise((resolve, reject) => {
      // Add to queue
      if (!requestQueue.current[url]) {
        requestQueue.current[url] = {
          timer: setTimeout(() => {
            const queue = requestQueue.current[url];
            if (queue) {
              // Execute the actual request
              fetch(url, options)
                .then(response => response.json())
                .then(data => {
                  // Resolve all waiting promises
                  queue.promises.forEach(p => p.resolve(data));
                })
                .catch(error => {
                  // Reject all waiting promises
                  queue.promises.forEach(p => p.reject(error));
                })
                .finally(() => {
                  delete requestQueue.current[url];
                });
            }
          }, THROTTLE_DELAY),
          promises: []
        };
      }

      // Add this promise to the queue
      requestQueue.current[url].promises.push({ resolve, reject });
    });
  }, []);

  return { throttledRequest };
};