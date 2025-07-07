import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  employeeId: number;
}

interface RecentChatSummaryProps {
  employeeId: number;
  zohoId?: string;
}

const RecentChatSummary: React.FC<RecentChatSummaryProps> = ({ employeeId, zohoId }) => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // FRONTEND CACHE BUG FIX - Stable key but with cache busting in query function
  const [cacheKey] = useState(`recent-summary-${employeeId}-${Date.now()}`);
  
  // BULLETPROOF MESSAGE PERSISTENCE - Zero tolerance for missing messages
  const { data: rawMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: [cacheKey],
    queryFn: async () => {
      // If we have ZohoID, use the ZohoID-based endpoint to eliminate mapping issues
      let apiUrl = `/api/chat-messages/${employeeId}?_bust=${Date.now()}`;
      if (zohoId) {
        apiUrl = `/api/chat-messages/zoho/${zohoId}?_bust=${Date.now()}`;
        console.log(`🚨 RecentChatSummary: Using ZohoID-based API for ${zohoId}`);
      }
      
      // Force fresh data with cache-busting headers
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 5000, // Ultra-fast 5-second refresh intervals
    staleTime: 0, // NEVER use cached data - always fetch fresh from server
    gcTime: 0, // NO cache retention - immediate garbage collection
    refetchOnWindowFocus: true, // ALWAYS refetch when window gains focus
    refetchOnMount: true, // ALWAYS refetch when component mounts
    refetchOnReconnect: true, // ALWAYS refetch when internet connection is restored
    refetchIntervalInBackground: true, // Continue refreshing even when tab is inactive
    retry: 5, // Aggressive retry attempts for failed requests
    retryDelay: 500, // Fast retry delay
    networkMode: 'always' // Always attempt network requests
  });

  // Process rawMessages directly without useEffect to avoid infinite loops
  const processedMessages = React.useMemo(() => {
    if (!Array.isArray(rawMessages)) return [];
    
    // Convert database messages to ChatMessage format
    const dbMessages: ChatMessage[] = rawMessages.map((msg: any) => ({
      id: msg.id.toString(),
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
      employeeId: msg.employeeId
    }));

    // Remove duplicates using same logic as other components
    const uniqueMessages = dbMessages.filter((msg, index, self) =>
      index === self.findIndex(m => 
        m.id === msg.id || 
        (m.content === msg.content && m.sender === msg.sender &&
         Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
      )
    );

    // Get the latest 3 unique messages for tooltip
    return uniqueMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [rawMessages]);

  // Connect to WebSocket server for real-time updates
  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("RecentChatSummary: WebSocket connected");
      setConnected(true);
      
      // Send a join message to let the server know which employee chat room to join
      const joinMessage = {
        type: "join",
        employeeId,
        sender: "Summary_Viewer"
      };
      socket.send(JSON.stringify(joinMessage));
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      // Only show messages for this employee - this component now uses processedMessages from useMemo
      // Real-time updates will be handled by the query refetch mechanism
      if (message.employeeId === employeeId) {
        // Just log for debugging - don't update state to avoid conflicts
        console.log(`New message received for employee ${employeeId}:`, message.content.substring(0, 30) + '...');
      }
    };
    
    socket.onclose = () => {
      console.log("RecentChatSummary: WebSocket disconnected");
      setConnected(false);
    };
    
    socket.onerror = (error) => {
      console.error("RecentChatSummary: WebSocket error:", error);
    };
    
    socketRef.current = socket;
    
    // Clean up on unmount
    return () => {
      socket.close();
    };
  }, [employeeId]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // This component doesn't render anything visible, but the processedMessages 
  // data is available for the main chat components to use
  return null;
};

export default RecentChatSummary;