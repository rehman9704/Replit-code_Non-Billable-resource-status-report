import React, { useState, useEffect, useRef, useMemo } from "react";
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
}

const RecentChatSummary: React.FC<RecentChatSummaryProps> = ({ employeeId }) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Fixed React Query setup - prevent infinite loops
  const { data: rawMessages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', employeeId],
    refetchInterval: 10000, // Reduced to 10 seconds to prevent excessive requests
    staleTime: 5000, // 5 seconds stale time
    gcTime: 30000, // 30 seconds cache time
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false, // Don't refetch in background
    retry: 3, // Reduced retry attempts
    retryDelay: 1000,
    networkMode: 'online'
  });

  // Process messages with useMemo to prevent recalculation
  const processedMessages = useMemo(() => {
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return [];
    }
    
    console.log(`Processing ${rawMessages.length} messages for employee ${employeeId}`);
    
    // Convert database messages to ChatMessage format
    const dbMessages: ChatMessage[] = rawMessages.map((msg: any) => ({
      id: msg.id.toString(),
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
      employeeId: msg.employeeId
    }));

    // Remove duplicates
    const uniqueMessages = dbMessages.filter((msg, index, self) =>
      index === self.findIndex(m => m.id === msg.id)
    );

    // Get the latest 3 unique messages
    const recentMessages = uniqueMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
    
    console.log(`Processed ${recentMessages.length} recent messages for employee ${employeeId}`);
    return recentMessages;
  }, [rawMessages, employeeId]);

  // WebSocket connection - only reconnect when employeeId changes
  useEffect(() => {
    if (!employeeId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log(`RecentChatSummary: WebSocket connected for employee ${employeeId}`);
      setConnected(true);
      
      const joinMessage = {
        type: "join",
        employeeId,
        sender: "Summary_Viewer"
      };
      socket.send(JSON.stringify(joinMessage));
    };
    
    socket.onclose = () => {
      console.log(`RecentChatSummary: WebSocket disconnected for employee ${employeeId}`);
      setConnected(false);
    };
    
    socket.onerror = (error) => {
      console.error(`RecentChatSummary: WebSocket error for employee ${employeeId}:`, error);
    };
    
    socketRef.current = socket;
    
    return () => {
      socket.close();
    };
  }, [employeeId]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="text-xs text-gray-500">
        Loading...
      </div>
    );
  }

  // Show message count if there are messages
  if (processedMessages.length > 0) {
    return (
      <div className="text-xs text-blue-600 font-medium">
        {processedMessages.length} recent message{processedMessages.length !== 1 ? 's' : ''}
        <div className="text-gray-500 mt-1">
          Last: {formatTime(processedMessages[0].timestamp)}
        </div>
      </div>
    );
  }

  // No messages
  return (
    <div className="text-xs text-gray-400">
      No messages
    </div>
  );
};

export default RecentChatSummary;