import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Message type definition
interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  employeeId: number;
}

interface CommentChatProps {
  employeeId: number;
  employeeName: string;
  initialComment?: string;
}

const CommentChat: React.FC<CommentChatProps> = ({ 
  employeeId, 
  employeeName,
  initialComment
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState(`User_${Math.floor(Math.random() * 10000)}`);
  const [open, setOpen] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add initial comment as first message if available
  useEffect(() => {
    if (initialComment && initialComment.trim() !== "-" && initialComment.trim() !== "") {
      setMessages([{
        id: "initial",
        sender: employeeName,
        content: initialComment,
        timestamp: new Date().toISOString(),
        employeeId
      }]);
    }
  }, [initialComment, employeeName, employeeId]);

  // Connect to WebSocket server when dialog opens
  useEffect(() => {
    if (!open) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket connected for employee", employeeId);
      setConnected(true);
      
      // Send a join message to let the server know which employee chat room to join
      const joinMessage = {
        type: "join",
        employeeId,
        sender: username
      };
      socket.send(JSON.stringify(joinMessage));
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      // Only show messages for this employee
      if (message.employeeId === employeeId) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    };
    
    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    socketRef.current = socket;
    
    // Clean up on unmount or when dialog closes
    return () => {
      socket.close();
    };
  }, [open, employeeId, username]);

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
      employeeId
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
    return name.split(/\s+/).map(word => word[0]?.toUpperCase() || '').join('').substring(0, 2);
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600">
          <MessageCircle size={16} />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md h-[500px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Chat with {employeeName}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-grow flex flex-col h-full overflow-hidden">
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
                          {getInitials(username)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          
          <div className="border-t p-4 mt-auto">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommentChat;