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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Fetch messages from database
  const { data: messageData = [] } = useQuery<any[]>({
    queryKey: [`/api/chat-messages/${employeeId}`],
    refetchInterval: 30000,
    staleTime: 0
  });

  // Load and deduplicate messages from database
  useEffect(() => {
    if (messageData && Array.isArray(messageData)) {
      // Convert and deduplicate database messages
      const dbMessages: ChatMessage[] = messageData.map((msg: any) => ({
        id: msg.id.toString(),
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp,
        employeeId: msg.employeeId
      }));

      // Apply deduplication
      const uniqueMessages = dbMessages.filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.id === msg.id || 
          (m.content === msg.content && m.sender === msg.sender &&
           Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        )
      );

      // Keep only the latest 3 messages for tooltip display
      const recentMessages = uniqueMessages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 3);

      setMessages(recentMessages);
    }
  }, [messageData]);

  // Connect to WebSocket server
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
        // Note: We now primarily rely on database queries for message data
        // WebSocket is mainly for real-time updates, but database queries handle the main data
        console.log("RecentChatSummary: New message via WebSocket for employee", employeeId);
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

  return (
    <div className="space-y-1 max-h-16 overflow-hidden">
      {messages.map((message, index) => (
        <div key={message.id} className="truncate">
          <span className="font-medium">{message.sender.split("_")[0]}</span>:{" "}
          {message.content.substring(0, 40)}{message.content.length > 40 ? "..." : ""}
          <span className="text-gray-400 ml-1 text-[10px]">
            {formatTime(message.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default RecentChatSummary;