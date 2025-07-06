import React, { useMemo } from "react";
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
  // Bulletproof query with complete cache elimination
  const { data: rawMessages = [], isLoading, error } = useQuery<ChatMessage[]>({
    queryKey: [`chat-messages-${employeeId}`, employeeId, Date.now()], // Force unique keys
    queryFn: async () => {
      console.log(`🔄 FETCHING messages for employee ${employeeId} at ${new Date().toISOString()}`);
      try {
        const response = await fetch(`/api/chat-messages/${employeeId}?t=${Date.now()}`);
        if (!response.ok) {
          console.error(`❌ RECENT CHAT: Failed to fetch messages: ${response.status}`);
          return []; // Return empty array instead of throwing
        }
        const data = await response.json();
        console.log(`✅ FETCHED ${data.length} messages for employee ${employeeId}:`, data);
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error(`❌ RECENT CHAT: Network error:`, err);
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

  // Process messages with memoization to prevent infinite renders
  const processedMessages = useMemo(() => {
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return [];
    }
    
    console.log(`Loading messages - messageData:`, rawMessages);
    console.log(`Type of messageData:`, typeof rawMessages);
    console.log(`Is array:`, Array.isArray(rawMessages));
    console.log(`Processing`, rawMessages.length, `messages from database`);
    
    // Convert database messages to ChatMessage format
    const dbMessages: ChatMessage[] = rawMessages.map((msg: any) => ({
      id: msg.id?.toString() || String(Math.random()),
      sender: msg.sender || 'Unknown',
      content: msg.content || '',
      timestamp: msg.timestamp || new Date().toISOString(),
      employeeId: msg.employeeId || employeeId
    }));

    console.log(`Converted messages:`, dbMessages);

    // Remove duplicates
    const uniqueMessages = dbMessages.filter((msg, index, self) =>
      index === self.findIndex(m => m.id === msg.id)
    );

    // Sort by timestamp (newest first) and take latest 3
    const recentMessages = uniqueMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
    
    console.log(`Final messages to display:`, recentMessages);
    return recentMessages;
  }, [rawMessages, employeeId]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Show message count with tooltip
  if (processedMessages.length === 0) {
    return <span className="text-xs text-gray-400">No messages</span>;
  }

  return (
    <div className="relative group">
      <span className="text-xs text-blue-600 cursor-help">
        {processedMessages.length} message{processedMessages.length !== 1 ? 's' : ''}
      </span>
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg min-w-[300px] max-w-[400px]">
        <h4 className="font-semibold mb-2 text-sm">Recent Chat Messages</h4>
        <div className="space-y-2">
          {processedMessages.map((message, index) => (
            <div key={message.id} className="border-b border-gray-700 pb-2 last:border-b-0">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-blue-300 font-medium">{message.sender}</span>
                <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">
                {message.content.length > 100 
                  ? `${message.content.substring(0, 100)}...` 
                  : message.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentChatSummary;