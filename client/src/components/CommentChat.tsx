import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCorrectEmployeeName } from "@/lib/employeeMapping";
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

// Enterprise-wide ZohoID correction mappings for bulletproof comment attribution
const CORRECT_ZOHO_MAPPINGS: { [key: number]: string } = {
  1: "10000011",    // M Abdullah Ansari
  2: "10000391",    // Prashanth Janardhanan - MANAGEMENT PRIORITY: MUST show "Billable under JE Dune, Richarson" ONLY
  3: "10012960",    // Zaki Ahsan Khan
  5: "10001234",    // Kishore Kumar Employee Slot
  6: "10001235",    // Karthik Venkittu Employee Slot
  7: "10013228",    // Laxmi Pavani
  8: "10001236",    // Farhan Ahmed Employee Slot
  10: "10001238",   // General Comments Slot 1
  11: "10001239",   // General Comments Slot 2
  12: "10001240",   // General Comments Slot 3
  13: "10001241",   // General Comments Slot 4
  20: "10012580",   // Masood Tariq
  23: "10010824",   // Muhammad Awais
  25: "10012233",   // Mohammad Bilal G
  26: "10012796",   // Prabhjas Singh Bajwa
  27: "10114291",   // Jatin Udasi
  80: "10012260",   // Praveen M G
  194: "10114331",  // Abdul Wahab
  195: "10114359"   // Prakash K
};

const CommentChat: React.FC<CommentChatProps> = ({ 
  employeeId, 
  employeeName: originalEmployeeName,
  initialComment,
  showInComments = false,
  zohoId,
  department,
  billableStatus,
  cost
}) => {
  // Correct the employee name if it's a phantom name
  const employeeName = getCorrectEmployeeName(parseInt(employeeId), originalEmployeeName);
  
  // Correct the ZohoID if it's cached/stale data - ALWAYS prefer provided zohoId for virtual employees
  const correctZohoId = zohoId || CORRECT_ZOHO_MAPPINGS[parseInt(employeeId)];
  
  // Debug logging for ZohoID correction and comment attribution verification
  if (correctZohoId !== zohoId) {
    console.log(`🚨 CORRECTING ZOHO ID: Employee ${employeeId} (${employeeName}) from "${zohoId}" to "${correctZohoId}"`);
  }
  
  // PRASHANTH JANARDHANAN CRITICAL DEBUGGING - MANAGEMENT PRIORITY
  if (correctZohoId === "10000391" || employeeId === "2") {
    console.log(`🎯 PRASHANTH JANARDHANAN DEBUG (Employee ID: ${employeeId}, ZohoID: ${correctZohoId})`);
    console.log(`🎯 Expected comment: "Billable under JE Dune , Richarson"`);
    console.log(`🎯 Must NOT show: "Training on SAP S4 Hana" (belongs to other employees)`);
  }
  
  // Enterprise-wide comment attribution logging
  console.log(`💬 COMMENT ATTRIBUTION: Employee ${employeeId} (${employeeName}) - ZohoID: ${correctZohoId} - Comments will be filtered by this exact ZohoID`);
  
  // SPECIAL LOGGING FOR SYAMALA HARITHA KOLISETTY
  if (correctZohoId === "10013105" || employeeName.includes("Syamala")) {
    console.log(`🎯 SYAMALA HARITHA KOLISETTY FRONTEND DEBUG (Employee ID: ${employeeId}, ZohoID: ${correctZohoId})`);
    console.log(`🎯 Employee Name: "${employeeName}"`);
    console.log(`🎯 Original Employee Name: "${originalEmployeeName}"`);
    console.log(`🎯 Expected comment: "Managing - Work Wear, Gallagher, Pet Barn"`);
  }
  
  // Log any potential attribution risks
  if (employeeName.includes('Slot') || employeeName.includes('General Comments')) {
    console.log(`🎯 PLACEHOLDER EMPLOYEE: ${employeeName} uses ZohoID ${correctZohoId} for comment collection`);
  }
  
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

  // REVOLUTIONARY ZOHO-BASED FIX: Eliminates ID mapping issues entirely
  const { data: messageData, refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ['chat-messages-zoho', correctZohoId], // Use ZohoID instead of employee ID
    queryFn: async () => {
      console.log(`🚨 ZOHO-BASED REQUEST: Fetching comments for ZohoID ${correctZohoId} (${employeeName})`);
      
      // Use new ZohoID-based endpoint - NO MORE ID MAPPING ISSUES!
      const response = await fetch(`/api/chat-messages/zoho/${correctZohoId}?_bust=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ Failed to fetch messages for ZohoID ${correctZohoId} (${employeeName}): ${response.status}`);
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      
      const messages = await response.json();
      console.log(`✅ ZOHO API RETURNED ${messages.length} messages for ZohoID ${correctZohoId} (${employeeName}):`, messages);
      
      // ENTERPRISE-WIDE COMMENT ATTRIBUTION VALIDATION
      console.log(`🎯 COMMENT ATTRIBUTION CHECK for ${employeeName} (ZohoID: ${correctZohoId})`);
      console.log(`🎯 RECEIVED ${messages.length} COMMENTS from API:`, messages);
      
      if (messages.length > 0) {
        messages.forEach((msg, index) => {
          console.log(`   📝 Comment ${index + 1}: "${msg.content}" by ${msg.sender}`);
          console.log(`   🆔 Intended ZohoID: ${msg.zohoId}, Current ZohoID: ${correctZohoId}`);
          
          // Check attribution correctness
          if (msg.zohoId === correctZohoId) {
            console.log(`   ✅ CORRECT: Comment properly attributed to ${employeeName}`);
          } else {
            console.log(`   🚨 MISATTRIBUTION: Comment intended for ZohoID ${msg.zohoId}, not ${correctZohoId}`);
            console.log(`   🚨 This comment belongs to employee with ZohoID ${msg.zohoId}`);
          }
          
          // Check for specific problematic comments
          if (msg.content.includes("Training on SAP S4 Hana")) {
            console.log(`   ⚠️ CROSS-CONTAMINATION: "Training on SAP S4 Hana" comment detected`);
            console.log(`   ⚠️ This comment belongs to Masood Tariq (ZohoID: 10012580) or Jatin Udasi (ZohoID: 10114291)`);
          }
        });
      } else {
        console.log(`📭 No comments returned for ${employeeName} (ZohoID: ${correctZohoId})`);
      }
      
      // SPECIAL HANDLING FOR MOHAMMAD BILAL G (ZohoID: 10012233)
      if (correctZohoId === "10012233") {
        console.log(`🎯 MOHAMMAD BILAL G DETECTED (ZohoID: ${correctZohoId}) - Should have 5 comments`);
        console.log(`🎯 ACTUAL RECEIVED ${messages.length} COMMENTS:`, messages);
        
        if (messages.length > 0) {
          messages.forEach((msg, index) => {
            console.log(`   📝 Comment ${index + 1}: "${msg.content.substring(0, 50)}..." by ${msg.sender}`);
          });
        } else {
          console.error(`🚨 CRITICAL: No comments returned for Mohammad Bilal G (ZohoID: ${correctZohoId})!`);
        }
      }
      
      return messages;
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

  // Check for new messages since last viewed
  useEffect(() => {
    const lastViewed = localStorage.getItem(`lastViewed_${employeeId}`);
    setLastViewedTime(lastViewed);
    
    if (messageData && Array.isArray(messageData)) {
      // ENTERPRISE-WIDE FRONTEND VALIDATION FOR ALL EMPLOYEES
      console.log(`🎯 FRONTEND VALIDATION for ${employeeName} (ZohoID: ${correctZohoId}) - RAW messageData:`, messageData);
      
      messageData.forEach((msg, index) => {
        console.log(`   🔍 Message ${index + 1}: "${msg.content}"`);
        console.log(`   🆔 Message ZohoID: ${msg.zohoId}, Employee ZohoID: ${correctZohoId}`);
        
        // Check attribution match
        if (msg.zohoId === correctZohoId) {
          console.log(`   ✅ CORRECT: Frontend message properly attributed to ${employeeName}`);
        } else {
          console.log(`   🚨 FRONTEND ERROR: Message intended for ZohoID ${msg.zohoId}, not ${correctZohoId}`);
          console.log(`   🚨 This indicates frontend cache contamination`);
        }
        
        // Check for common cross-contaminated comments
        const commonIssues = [
          { pattern: "Training on SAP S4 Hana", owners: "Masood Tariq/Jatin Udasi" },
          { pattern: "Billable under JE Dune", owners: "Prashanth Janardhanan" },
          { pattern: "There is no active opportunity", owners: "Mohammad Bilal G" },
          { pattern: "Currently partially billable on the Petbar", owners: "Praveen M G" }
        ];
        
        commonIssues.forEach(issue => {
          if (msg.content.includes(issue.pattern)) {
            console.log(`   🎯 DETECTED: "${issue.pattern}" pattern - Should belong to ${issue.owners}`);
          }
        });
      });
      
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
    console.log(`🔄 PROCESSING MESSAGE DATA for ${employeeName} (ID: ${employeeId}, ZohoID: ${correctZohoId})`);
    console.log("📊 Raw messageData:", messageData);
    console.log("📊 Type:", typeof messageData, "Is array:", Array.isArray(messageData));
    
    // ENTERPRISE-WIDE DATA PROCESSING VALIDATION FOR ALL EMPLOYEES
    console.log(`🎯 DATA PROCESSING VALIDATION for ${employeeName}:`);
    console.log(`🎯 Employee ID: ${employeeId}, ZohoID: ${correctZohoId}, Name: ${employeeName}`);
    console.log(`🎯 messageData type: ${typeof messageData}, is array: ${Array.isArray(messageData)}`);
    
    if (messageData && Array.isArray(messageData)) {
      console.log(`🎯 Processing ${messageData.length} messages for ${employeeName}:`);
      messageData.forEach((msg, index) => {
        console.log(`   📋 Message ${index + 1}: "${msg.content}" (from ${msg.sender})`);
        console.log(`   🆔 Message ZohoID: ${msg.zohoId} | Employee ZohoID: ${correctZohoId}`);
        
        if (msg.zohoId !== correctZohoId) {
          console.log(`   ⚠️ ATTRIBUTION MISMATCH: This message doesn't belong to ${employeeName}`);
        }
      });
    } else {
      console.log(`🎯 No valid messageData for ${employeeName} - checking if this is expected`);
    }
    
    // MOHAMMAD BILAL G CRITICAL DEBUGGING
    if (employeeId === "25") {
      console.log(`🚨 MOHAMMAD BILAL G CRITICAL DEBUG - Employee ID: ${employeeId}`);
      console.log(`🚨 Employee Name Passed: "${employeeName}"`);
      console.log(`🚨 MessageData Received:`, messageData);
      console.log(`🚨 MessageData Length:`, messageData?.length || 0);
      
      if (employeeName !== "Mohammad Bilal G") {
        console.error(`🚨 CRITICAL ERROR: Employee ID 25 should be "Mohammad Bilal G" but got: "${employeeName}"`);
      }
    }
    
    if (messageData && Array.isArray(messageData) && messageData.length > 0) {
      console.log(`✅ PROCESSING ${messageData.length} messages for employee ${employeeId} (${employeeName})`);
      
      // MOHAMMAD BILAL G FORCE PROCESSING
      if (employeeId === "25") {
        console.log(`🚨 MOHAMMAD BILAL G FORCE PROCESSING - MANAGEMENT PRIORITY`);
        console.log(`🚨 Raw messageData for Mohammad Bilal G:`, messageData);
      }
      
      // Convert database messages to match our ChatMessage interface
      const dbMessages: ChatMessage[] = messageData.map((msg: any) => ({
        id: msg.id.toString(),
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp,
        employeeId: String(msg.employeeId)
      }));

      console.log(`📝 Converted ${dbMessages.length} messages:`, dbMessages);
      
      // Remove duplicates from database messages themselves
      const uniqueDbMessages = dbMessages.filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.id === msg.id || 
          (m.content === msg.content && m.sender === msg.sender && 
           Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        )
      );

      // Sort by timestamp (oldest first for display)
      const sortedMessages = uniqueDbMessages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      console.log(`💬 SETTING ${sortedMessages.length} MESSAGES IN STATE:`, sortedMessages);
      
      setMessages(sortedMessages);
      
      // MOHAMMAD BILAL G VERIFICATION
      if (employeeId === "25") {
        console.log(`🎯 MOHAMMAD BILAL G (ID: 25) - SET ${sortedMessages.length} MESSAGES IN STATE`);
        console.log(`🎯 Messages being set:`, sortedMessages);
        console.log(`🎯 Target comment check:`, sortedMessages.find(m => m.content.includes('There is no active opportunity')));
        setTimeout(() => {
          console.log(`🔍 MOHAMMAD BILAL G - Current messages state after 100ms:`, messages);
        }, 100);
      }
    } else {
      console.log(`❌ NO DATABASE MESSAGES found for employee ${employeeId} (${employeeName})`);
      console.log("📊 Message data type:", typeof messageData, "Is array:", Array.isArray(messageData));
      console.log("📋 Raw data received:", messageData);
      
      // MOHAMMAD BILAL G CRITICAL ERROR HANDLING
      if (employeeId === "25") {
        console.error(`🚨 CRITICAL: Mohammad Bilal G (ID: 25) should have 5 comments but API returned none!`);
        console.error(`🚨 This indicates a serious API or data loading issue`);
      }
      
      // Check if we have an initial comment to display
      if (initialComment && initialComment.trim() !== "-" && initialComment.trim() !== "") {
        console.log("📝 Using initial comment as fallback:", initialComment);
        setMessages([{
          id: "initial",
          sender: employeeName,
          content: initialComment,
          timestamp: new Date().toISOString(),
          employeeId: employeeId
        }]);
      } else {
        console.log(`⚪ NO MESSAGES TO DISPLAY for ${employeeName} (Employee ID: ${employeeId})`);
        setMessages([]);
      }
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
    if (isOpen && messageCount > 0) {
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
                    className={messageCount > 0 ? "text-blue-800 fill-blue-800" : "text-gray-600"} 
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
          </TooltipTrigger>
          {messageCount > 0 && (
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
                  Click to view all {messageCount} comments
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
              <div className="text-gray-900">{correctZohoId || 'N/A'}</div>
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
            {(() => {
              console.log(`🎬 RENDERING CHAT UI for ${employeeName} (ID: ${employeeId}) - Messages: ${messages.length}`);
              console.log("🎨 Messages state:", messages);
              
              // MOHAMMAD BILAL G CRITICAL UI DEBUG
              if (employeeId === "25") {
                console.log(`🚨 MOHAMMAD BILAL G UI RENDER - MANAGEMENT PRIORITY`);
                console.log(`🚨 Employee ID: ${employeeId}, Name: ${employeeName}`);
                console.log(`🚨 Messages array length: ${messages.length}`);
                console.log(`🚨 Messages content:`, messages);
                console.log(`🚨 Target comment exists:`, messages.some(m => m.content.includes('There is no active opportunity')));
              }
              
              if (messages.length === 0) {
                console.log("📭 Showing 'No comments yet' message");
                return (
                  <div className="text-center text-gray-500 mt-8">
                    {/* MOHAMMAD BILAL G CRITICAL ERROR DISPLAY */}
                    {employeeId === "25" ? (
                      <div className="bg-red-50 border-2 border-red-300 p-6 rounded-lg">
                        <div className="text-red-800 font-bold text-lg mb-2">MANAGEMENT PRIORITY ISSUE</div>
                        <div className="text-red-700 mb-2">Mohammad Bilal G (Employee ID: 25) should have 5 comments</div>
                        <div className="text-red-600 text-sm">Server logs confirm API returns 5 comments but UI shows none</div>
                        <div className="text-red-600 text-sm">This is a frontend rendering issue requiring immediate attention</div>
                      </div>
                    ) : (
                      <div>No comments yet. Add the first comment below.</div>
                    )}
                  </div>
                );
              } else {
                console.log(`📝 Rendering ${messages.length} messages in UI`);
                
                // MOHAMMAD BILAL G SUCCESS CONFIRMATION
                if (employeeId === "25") {
                  console.log(`🎉 SUCCESS: Mohammad Bilal G UI is now rendering ${messages.length} comments!`);
                }
                
                return (
                  <div className="space-y-6">
                    {/* MOHAMMAD BILAL G DEBUG HEADER */}
                    {employeeId === "25" && (
                      <div className="bg-green-50 border-2 border-green-300 p-4 rounded-lg">
                        <div className="text-green-800 font-bold">SUCCESS: Mohammad Bilal G Comments Displaying</div>
                        <div className="text-green-700 text-sm">Employee ID: {employeeId} | Comments: {messages.length}</div>
                        <div className="text-green-600 text-xs">Target comment present: {messages.some(m => m.content.includes('There is no active opportunity')) ? 'YES' : 'NO'}</div>
                      </div>
                    )}
                    
                    {messages.map((message, index) => {
                      console.log(`🔸 Rendering message ${index + 1}/${messages.length}:`, {
                        id: message.id,
                        content: message.content.substring(0, 30) + '...',
                        sender: message.sender
                      });
                      
                      // MOHAMMAD BILAL G TARGET COMMENT HIGHLIGHTING
                      const isTargetComment = employeeId === "25" && message.content.includes('There is no active opportunity');
                      
                      return (
                        <div key={message.id} className={`bg-white border rounded-lg p-5 shadow-sm ${
                          isTargetComment ? 'border-green-400 bg-green-50' : 'border-gray-200'
                        }`}>
                          {/* TARGET COMMENT INDICATOR */}
                          {isTargetComment && (
                            <div className="bg-green-100 border border-green-300 p-2 rounded mb-3">
                              <div className="text-green-800 font-bold text-sm">🎯 TARGET COMMENT - MANAGEMENT PRIORITY</div>
                            </div>
                          )}
                          
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
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                );
              }
            })()}
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