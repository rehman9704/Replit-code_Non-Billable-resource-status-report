import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";

// Message type definition
interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
}

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState(`User_${Math.floor(Math.random() * 10000)}`);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to WebSocket server
  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, message]);
    };
    
    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    socketRef.current = socket;
    
    // Clean up on unmount
    return () => {
      socket.close();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = () => {
    if (newMessage.trim() === "" || !connected) return;
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: username,
      content: newMessage,
      timestamp: new Date().toISOString(),
    };
    
    socketRef.current?.send(JSON.stringify(message));
    setNewMessage("");
  };

  // Handle key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split("_")[0].charAt(0).toUpperCase();
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Team Chat</span>
          <span className={`text-sm px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow flex flex-col h-full p-0">
        <ScrollArea className="flex-grow p-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-secondary">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${
                    message.sender === username ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender !== username && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-white text-xs">
                        {getInitials(message.sender)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.sender === username
                        ? "bg-primary text-white"
                        : "bg-neutral-100"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{message.sender}</span>
                      <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
                    </div>
                    <p>{message.content}</p>
                  </div>
                  {message.sender === username && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-white text-xs">
                        {getInitials(message.sender)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
        
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={!connected}
              className="flex-grow"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!connected || newMessage.trim() === ""}
              className="px-3"
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatPanel;