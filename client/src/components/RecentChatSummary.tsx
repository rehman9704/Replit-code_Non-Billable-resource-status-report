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
  const [initialLoaded, setInitialLoaded] = useState(false);



  // Load initial unique messages once
  useEffect(() => {
    if (!initialLoaded) {
      const loadUniqueMessages = async () => {
        try {
          const response = await fetch(`/api/chat-messages/${employeeId}`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              // Convert database messages to ChatMessage format
              const dbMessages: ChatMessage[] = data.map((msg: any) => ({
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

              console.log(`RecentChatSummary Employee ${employeeId}: Raw DB messages:`, dbMessages.length);
              console.log(`RecentChatSummary Employee ${employeeId}: Unique messages:`, uniqueMessages.length);
              console.log(`RecentChatSummary Employee ${employeeId}: Setting final messages:`, recentMessages);
              setMessages(recentMessages);
            }
          }
        } catch (error) {
          console.error("Error loading unique messages:", error);
        }
        setInitialLoaded(true);
      };

      loadUniqueMessages();
    }
  }, [employeeId, initialLoaded]);

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