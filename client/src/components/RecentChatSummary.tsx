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
}

const RecentChatSummary: React.FC<RecentChatSummaryProps> = ({ employeeId }) => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // BULLETPROOF MESSAGE PERSISTENCE - Zero tolerance for missing messages
  const { data: rawMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chat-messages/${employeeId}`],
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

  // Process and deduplicate messages when rawMessages change
  useEffect(() => {
    if (!Array.isArray(rawMessages)) return;
    
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
    const recentMessages = uniqueMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
    
    setMessages(recentMessages);
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
      
      // Only show messages for this employee
      if (message.employeeId === employeeId) {
        setMessages((prevMessages) => {
          // Create a combined array with the new message
          const allMessages = [...prevMessages, message];
          
          // Apply comprehensive deduplication
          const uniqueMessages = allMessages.filter((msg, index, self) =>
            index === self.findIndex(m => 
              m.id === msg.id || 
              (m.content === msg.content && m.sender === msg.sender &&
               Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
            )
          );
          
          // Keep only the latest 3 unique messages
          const recentUniqueMessages = uniqueMessages
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 3);
          
          return recentUniqueMessages;
        });
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

  if (messages.length === 0) {
    return null;
  }

  // Don't display any text content under the chat icon
  return null;
};

export default RecentChatSummary;