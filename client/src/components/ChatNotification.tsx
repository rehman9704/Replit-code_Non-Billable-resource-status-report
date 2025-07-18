import React, { useState, useEffect } from "react";
import { MessageCircle, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  employeeId: number;
}

interface ChatNotificationProps {
  employeeId: string;
  employeeName: string;
  onChatOpen?: () => void;
}

const ChatNotification: React.FC<ChatNotificationProps> = ({ 
  employeeId, 
  employeeName,
  onChatOpen 
}) => {
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [lastViewedTime, setLastViewedTime] = useState<string | null>(null);

  // FRONTEND CACHE BUG FIX - Stable key but with cache busting in query function
  const [cacheKey] = useState(`chat-notification-${employeeId}-${Date.now()}`);
  
  // BULLETPROOF MESSAGE PERSISTENCE - Zero tolerance for missing messages
  const { data: rawMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: [cacheKey],
    queryFn: async () => {
      // Force fresh data with cache-busting headers
      const response = await fetch(`/api/chat-messages/${employeeId}?_bust=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      return response.json();
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

  // Apply deduplication logic (same as in CommentChat.tsx)
  const messages = (rawMessages as ChatMessage[]).filter((msg: ChatMessage, index: number, self: ChatMessage[]) =>
    index === self.findIndex((m: ChatMessage) => 
      m.id === msg.id || 
      (m.content === msg.content && m.sender === msg.sender &&
       Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
    )
  );

  // Check for new messages since last viewed
  useEffect(() => {
    const lastViewed = localStorage.getItem(`lastViewed_${employeeId}`);
    setLastViewedTime(lastViewed);
    
    if (lastViewed && messages.length > 0) {
      const hasNew = messages.some(msg => 
        new Date(msg.timestamp) > new Date(lastViewed)
      );
      setHasNewMessages(hasNew);
    } else if (messages.length > 0) {
      setHasNewMessages(true);
    }
  }, [messages, employeeId]);

  const handleViewMessages = () => {
    const now = new Date().toISOString();
    localStorage.setItem(`lastViewed_${employeeId}`, now);
    setLastViewedTime(now);
    setHasNewMessages(false);
  };

  const recentMessages = messages
    .slice(-5) // Show last 5 messages
    .reverse(); // Show newest first

  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  return (
    <Popover onOpenChange={(open) => {
      if (open) {
        handleViewMessages();
      }
    }}>
      <PopoverTrigger asChild>
        <button 
          className="relative inline-flex items-center justify-center p-1 rounded-full hover:bg-gray-100 transition-colors"
          onClick={onChatOpen}
        >
          <MessageCircle 
            className={`h-4 w-4 ${
              messages.length > 0 
                ? "text-blue-800 fill-blue-800" 
                : "text-gray-500"
            }`} 
          />
          {messages.length > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white border-white text-xs font-bold rounded-full"
              variant="destructive"
            >
              {messages.length}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      
      {messages.length > 0 && (
        <PopoverContent 
          className="w-80 p-0" 
          align="end"
          side="left"
        >
          <div className="border-b p-3 bg-blue-50">
            <h4 className="font-semibold text-sm text-blue-900">Recent Comments</h4>
            <p className="text-xs text-blue-700">{employeeName}</p>
          </div>
          
          <ScrollArea className="h-64">
            <div className="p-2 space-y-2">
              {recentMessages.length > 0 ? (
                recentMessages.map((message) => (
                  <div 
                    key={message.id} 
                    className="p-2 rounded-lg bg-gray-50 border-l-4 border-blue-500"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-900">
                        {message.sender}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getTimeAgo(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500 text-xs">
                  No comments yet
                </div>
              )}
            </div>
          </ScrollArea>
          
          {messages.length > 5 && (
            <div className="border-t p-2 text-center">
              <button 
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={onChatOpen}
              >
                View all messages
              </button>
            </div>
          )}
        </PopoverContent>
      )}
    </Popover>
  );
};

export default ChatNotification;