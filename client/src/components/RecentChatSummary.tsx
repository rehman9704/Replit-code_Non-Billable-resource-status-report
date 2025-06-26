import React, { useState, useEffect, useRef } from "react";

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
        setMessages((prevMessages) => {
          // Check for duplicates before adding
          const exists = prevMessages.some(existingMsg => 
            existingMsg.id === message.id || 
            (existingMsg.content === message.content && 
             existingMsg.sender === message.sender &&
             Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
          );
          
          if (exists) {
            console.log("RecentChatSummary: Duplicate message detected, skipping:", message);
            return prevMessages;
          }
          
          // Keep only the latest 3 messages
          const updatedMessages = [...prevMessages, message]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 3);
          return updatedMessages;
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