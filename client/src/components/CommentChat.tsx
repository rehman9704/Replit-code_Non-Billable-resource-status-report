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
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

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

  // Bulletproof query with complete cache elimination
  const { data: messageData, refetch: refetchMessages, error, isLoading } = useQuery<any[]>({
    queryKey: [`comment-chat-${employeeId}`, employeeId, Date.now()], // Force unique keys
    queryFn: async () => {
      console.log(`🔄 COMMENT CHAT: Fetching messages for employee ${employeeId}`);
      try {
        const response = await fetch(`/api/chat-messages/${employeeId}?t=${Date.now()}`);
        if (!response.ok) {
          console.error(`❌ COMMENT CHAT: Failed to fetch messages: ${response.status}`);
          return []; // Return empty array instead of throwing
        }
        const data = await response.json();
        console.log(`✅ COMMENT CHAT: Got ${data.length} messages for employee ${employeeId}`);
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error(`❌ COMMENT CHAT: Network error:`, err);
        return []; // Return empty array on network errors
      }
    },
    refetchInterval: 3000, // Very fast refresh
    staleTime: 0, // Never use stale data
    gcTime: 0, // No garbage collection time
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    enabled: !!employeeId,
    retry: 3, // Reduce retry attempts
    retryDelay: 1000
  });

  // Check for new messages since last viewed
  useEffect(() => {
    const lastViewed = localStorage.getItem(`lastViewed_${employeeId}`);
    setLastViewedTime(lastViewed);
    
    if (messageData && Array.isArray(messageData)) {
      // Apply deduplication to count messages properly
      const deduplicatedMessages = messageData.filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.id === msg.id || 
          (m.content === msg.content && m.sender === msg.sender &&
           Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        )
      );
      
      // Set total message count based on deduplicated messages
      setMessageCount(deduplicatedMessages.length);
      
      if (lastViewed && messageData.length > 0) {
        const hasNew = messageData.some((msg: any) => 
          new Date(msg.timestamp) > new Date(lastViewed)
        );
        setHasNewMessages(hasNew);
      } else if (messageData.length > 0) {
        setHasNewMessages(true);
      } else {
        setHasNewMessages(false);
      }
    } else {
      setMessageCount(0);
      setHasNewMessages(false);
    }
  }, [messageData, employeeId, open]);

  // Load existing messages from database when dialog opens
  useEffect(() => {
    console.log("Loading messages - messageData:", messageData);
    console.log("Type of messageData:", typeof messageData);
    console.log("Is array:", Array.isArray(messageData));
    
    if (messageData && Array.isArray(messageData)) {
      console.log("Processing", messageData.length, "messages from database");
      
      // Convert database messages to match our ChatMessage interface
      const dbMessages: ChatMessage[] = messageData.map((msg: any) => ({
        id: msg.id.toString(),
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp,
        employeeId: String(msg.employeeId)
      }));

      console.log("Converted messages:", dbMessages);
      
      // Remove duplicates from database messages themselves
      const uniqueDbMessages = dbMessages.filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.id === msg.id || 
          (m.content === msg.content && m.sender === msg.sender && 
           Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        )
      );

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

      // Combine all messages and apply final deduplication
      const allMessages = [...initialMsg, ...uniqueDbMessages];
      const finalUniqueMessages = allMessages.filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.id === msg.id || 
          (m.content === msg.content && m.sender === msg.sender &&
           Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        )
      );

      // Sort by timestamp (oldest first for display)
      const sortedMessages = finalUniqueMessages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      console.log("Final messages to display:", sortedMessages);
      setMessages(sortedMessages);
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
  }, [messageData, initialComment, employeeName, employeeId]);

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
        setMessages((prevMessages) => {
          // Check for duplicates before adding
          const exists = prevMessages.some(existingMsg => 
            existingMsg.id === message.id || 
            (existingMsg.content === message.content && 
             existingMsg.sender === message.sender &&
             Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
          );
          
          if (exists) {
            console.log("Duplicate message detected, skipping:", message);
            return prevMessages;
          }
          
          return [...prevMessages, message];
        });
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
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        // If saving failed, add message locally as fallback with deduplication
        setMessages((prevMessages) => {
          const exists = prevMessages.some(existingMsg => 
            existingMsg.id === message.id || 
            (existingMsg.content === message.content && 
             existingMsg.sender === message.sender &&
             Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
          );
          
          if (exists) {
            console.log("Duplicate message detected in fallback, skipping:", message);
            return prevMessages;
          }
          
          return [...prevMessages, message];
        });
      }
    } catch (error) {
      console.error("❌ Error saving message to database:", error);
      // If saving failed, add message locally as fallback with deduplication
      setMessages((prevMessages) => {
        const exists = prevMessages.some(existingMsg => 
          existingMsg.id === message.id || 
          (existingMsg.content === message.content && 
           existingMsg.sender === message.sender &&
           Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
        );
        
        if (exists) {
          console.log("Duplicate message detected in fallback, skipping:", message);
          return prevMessages;
        }
        
        return [...prevMessages, message];
      });
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
    if (isOpen && messageData && messageData.length > 0) {
      const now = new Date().toISOString();
      localStorage.setItem(`lastViewed_${employeeId}`, now);
      setLastViewedTime(now);
      setHasNewMessages(false);
    }
  };

  // Get recent messages for tooltip
  // Apply deduplication to recentMessages for tooltip display  
  const recentMessages = messageData && Array.isArray(messageData) ? 
    messageData
      .filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.id === msg.id || 
          (m.content === msg.content && m.sender === msg.sender &&
           Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        )
      )
      .slice(-3)
      .reverse() 
    : [];

  return (
    <Dialog open={open} onOpenChange={handleDialogOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <div className="relative">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600">
                  <MessageCircle 
                    size={16} 
                    className={(messageData && messageData.length > 0) ? "text-blue-800 fill-blue-800" : "text-gray-600"} 
                  />
                </Button>
                {(messageData && messageData.length > 0) && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-white border-white text-xs flex items-center justify-center rounded-full"
                    variant="destructive"
                  >
                    {messageData.length}
                  </Badge>
                )}
              </div>
            </DialogTrigger>
          </TooltipTrigger>
          {(messageData && messageData.length > 0) && (
            <TooltipContent side="left" className="max-w-sm p-0 bg-white border shadow-lg">
              <div className="bg-blue-800 text-white px-3 py-2">
                <div className="font-semibold text-sm">
                  Recent Comments - {employeeName}
                </div>
              </div>
              <div className="p-3">
                <div className="space-y-2">
                  {recentMessages.map((msg: any, index) => (
                    <div key={msg.id || index} className="text-xs">
                      <div className="font-medium text-gray-700">{msg.sender}</div>
                      <div className="text-gray-600 line-clamp-2">{msg.content}</div>
                      <div className="text-gray-400 text-xs mt-1">
                        {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                      </div>
                      {index < recentMessages.length - 1 && <hr className="mt-2" />}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                  Click to view all {messageData.length} comments
                </div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      
      <DialogContent className="sm:max-w-4xl w-full h-[700px] flex flex-col bg-white">
        <DialogHeader className="bg-blue-600 text-white p-4 -m-6 mb-0">
          <DialogTitle className="text-lg font-semibold text-white">
            {employeeName}
          </DialogTitle>
        </DialogHeader>
        
        {/* Employee Information Section */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-6 text-sm">
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
          <div className="p-6 border-b">
            <h3 className="font-semibold text-lg text-gray-900">Comments History</h3>
          </div>
          
          <ScrollArea className="flex-grow p-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                No comments yet. Add the first comment below.
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                    <div className="text-gray-800 mb-3 text-base leading-relaxed">{message.content}</div>
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span className="font-medium">{message.sender}</span>
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
          <div className="border-t p-6 mt-auto bg-white">
            <div className="mb-4">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && sendMessage()}
                placeholder="Add a comment..."
                className="w-full p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                rows={4}
              />
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={sendMessage} 
                disabled={newMessage.trim() === ""}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base"
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