import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

// Message type definition
interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  employeeId: string;
}

interface CommentChatProps {
  employeeId: string;
  employeeName: string;
  initialComment?: string;
  showInComments?: boolean;
  zohoId?: string;
  department?: string;
  billableStatus?: string;
  cost?: number;
}

const CommentChat: React.FC<CommentChatProps> = ({ 
  employeeId, 
  employeeName,
  initialComment,
  showInComments = false,
  zohoId,
  department,
  billableStatus,
  cost
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [lastViewedTime, setLastViewedTime] = useState<string | null>(null);
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch existing chat messages from database
  const { data: existingMessages, refetch: refetchMessages } = useQuery({
    queryKey: [`/api/chat-messages/${employeeId}`],
    enabled: open, // Only fetch when dialog is open
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true
  });

  // Also fetch for notification purposes when chat is closed
  const { data: notificationMessages } = useQuery({
    queryKey: [`/api/chat-messages-notification/${employeeId}`],
    enabled: !open, // Only fetch when dialog is closed
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 0
  });

  // Check for new messages since last viewed
  useEffect(() => {
    const lastViewed = localStorage.getItem(`lastViewed_${employeeId}`);
    setLastViewedTime(lastViewed);
    
    const messagesToCheck = open ? existingMessages : notificationMessages;
    
    if (messagesToCheck && Array.isArray(messagesToCheck)) {
      // Set total message count
      setMessageCount(messagesToCheck.length);
      
      if (lastViewed && messagesToCheck.length > 0) {
        const hasNew = messagesToCheck.some((msg: any) => 
          new Date(msg.timestamp) > new Date(lastViewed)
        );
        setHasNewMessages(hasNew);
      } else if (messagesToCheck.length > 0) {
        setHasNewMessages(true);
      } else {
        setHasNewMessages(false);
      }
    } else {
      setMessageCount(0);
      setHasNewMessages(false);
    }
  }, [existingMessages, notificationMessages, employeeId, open]);

  // Load existing messages from database when dialog opens
  useEffect(() => {
    console.log("Loading messages - existingMessages:", existingMessages);
    console.log("Type of existingMessages:", typeof existingMessages);
    console.log("Is array:", Array.isArray(existingMessages));
    
    if (existingMessages && Array.isArray(existingMessages)) {
      console.log("Processing", existingMessages.length, "messages from database");
      
      // Convert database messages to match our ChatMessage interface
      const dbMessages: ChatMessage[] = existingMessages.map((msg: any) => ({
        id: msg.id.toString(),
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp,
        employeeId: String(msg.employeeId)
      }));

      console.log("Converted messages:", dbMessages);

      // Add initial comment if available and not already in database
      const initialMsg = initialComment && initialComment.trim() !== "-" && initialComment.trim() !== "" 
        ? [{
            id: "initial",
            sender: employeeName,
            content: initialComment,
            timestamp: new Date().toISOString(),
            employeeId: employeeId
          }]
        : [];

      // Combine and sort messages by timestamp
      const allMessages = [...initialMsg, ...dbMessages].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      console.log("Final messages to display:", allMessages);
      setMessages(allMessages);
    } else if (initialComment && initialComment.trim() !== "-" && initialComment.trim() !== "") {
      console.log("No database messages, using initial comment only");
      // Fallback to just initial comment if no database messages
      setMessages([{
        id: "initial",
        sender: employeeName,
        content: initialComment,
        timestamp: new Date().toISOString(),
        employeeId: employeeId
      }]);
    } else {
      console.log("No messages to display");
      setMessages([]);
    }
  }, [existingMessages, initialComment, employeeName, employeeId]);

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
        sender: user?.displayName || 'Anonymous User'
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
  }, [open, employeeId, user?.displayName]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    console.log("Send message called, newMessage:", newMessage);
    console.log("Connected state:", connected);
    console.log("Socket state:", socketRef.current?.readyState);
    
    if (newMessage.trim() === "") {
      console.log("Empty message, returning");
      return;
    }
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: user?.displayName || 'Anonymous User',
      content: newMessage,
      timestamp: new Date().toISOString(),
      employeeId: employeeId
    };
    
    setNewMessage("");
    
    // Save message to database via REST API (primary persistence method)
    try {
      const response = await fetch('/api/chat-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: Number(message.employeeId),
          sender: message.sender,
          content: message.content,
        }),
      });
      
      if (response.ok) {
        console.log("✅ Message saved to database via REST API");
        // Refresh messages from database to show the saved message
        await refetchMessages();
      } else {
        console.error("❌ Failed to save message to database:", response.status);
        // If saving failed, add message locally as fallback
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    } catch (error) {
      console.error("❌ Error saving message to database:", error);
      // If saving failed, add message locally as fallback
      setMessages((prevMessages) => [...prevMessages, message]);
    }
    
    // Also send via WebSocket for real-time updates to other users
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        console.log("Sending WebSocket message for real-time updates:", message);
        socketRef.current.send(JSON.stringify(message));
        console.log("✅ Message sent via WebSocket for real-time updates");
      } catch (error) {
        console.error("❌ Error sending via WebSocket:", error);
      }
    } else {
      console.log("WebSocket not available for real-time updates");
    }
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

  // Handle dialog open to mark messages as viewed
  const handleDialogOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && messageCount > 0) {
      const now = new Date().toISOString();
      localStorage.setItem(`lastViewed_${employeeId}`, now);
      setLastViewedTime(now);
      setHasNewMessages(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <div className="relative">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600">
            <MessageCircle 
              size={16} 
              className={messageCount > 0 ? "text-blue-600 fill-blue-100" : ""} 
            />
          </Button>
          {messageCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-white border-white text-xs flex items-center justify-center rounded-full"
              variant="destructive"
            >
              {messageCount}
            </Badge>
          )}
        </div>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg w-full h-[600px] flex flex-col bg-white">
        <DialogHeader className="bg-blue-600 text-white p-4 -m-6 mb-0">
          <DialogTitle className="text-lg font-semibold text-white">
            {employeeName}
          </DialogTitle>
        </DialogHeader>
        
        {/* Employee Information Section */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Zoho ID</span>
              <div className="text-gray-900">{zohoId || 'N/A'}</div>
            </div>
            <div>
              <span className="font-medium text-gray-600">Department</span>
              <div className="text-gray-900">{department || 'N/A'}</div>
            </div>
            <div>
              <span className="font-medium text-gray-600">Status</span>
              <div className="text-gray-900">{billableStatus || 'N/A'}</div>
            </div>
            <div>
              <span className="font-medium text-gray-600">Cost</span>
              <div className="text-gray-900">
                {(() => {
                  console.log("Cost value:", cost, "Type:", typeof cost);
                  if (!cost) return 'N/A';
                  
                  // Handle string values that might have $ or commas
                  let cleanCost = String(cost).replace(/[$,]/g, '');
                  let numericCost = Number(cleanCost);
                  
                  console.log("Cleaned cost:", cleanCost, "Numeric cost:", numericCost);
                  
                  return !isNaN(numericCost) && numericCost > 0 
                    ? Math.round(numericCost).toLocaleString() 
                    : 'N/A';
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Comments History Section */}
        <div className="flex-grow flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Comments History</h3>
          </div>
          
          <ScrollArea className="flex-grow p-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                No comments yet. Add the first comment below.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-gray-800 mb-2">{message.content}</div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{message.sender}</span>
                      <span>{new Date(message.timestamp).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          
          {/* Add Comment Section */}
          <div className="border-t p-4 mt-auto bg-white">
            <div className="mb-3">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && sendMessage()}
                placeholder="Add a comment..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={sendMessage} 
                disabled={newMessage.trim() === ""}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2"
              >
                Add Comment
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommentChat;