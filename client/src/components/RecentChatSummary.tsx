import React, { useState, useEffect } from 'react';

interface ChatMessage {
  id: number;
  employeeId: number;
  sender: string;
  content: string;
  timestamp: string;
}

interface RecentChatSummaryProps {
  employeeId: number;
}

const RecentChatSummary: React.FC<RecentChatSummaryProps> = ({ employeeId }) => {
  const [messageCount, setMessageCount] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchMessages = async () => {
      try {
        // Only set loading to true on initial load, not on refreshes
        if (messageCount === 0) {
          setLoading(true);
        }
        
        const response = await fetch(`/api/chat-messages/${employeeId}`);
        
        if (response.ok && isMounted) {
          const data = await response.json();
          const msgArray = Array.isArray(data) ? data : [];
          
          setMessages(msgArray);
          setMessageCount(msgArray.length);
          
          // Debug logging for employees with messages
          if (msgArray.length > 0) {
            console.log(`🎯 CHAT DISPLAY: Employee ${employeeId} has ${msgArray.length} messages`);
          }
        } else {
          console.error(`Failed to fetch messages for employee ${employeeId}:`, response.status);
        }
      } catch (error) {
        console.error(`Error fetching messages for employee ${employeeId}:`, error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMessages();
    
    // Refresh every 10 seconds instead of 5 to reduce server load
    const interval = setInterval(fetchMessages, 10000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [employeeId]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading || messageCount === 0) {
    return null; // Don't show anything when loading or no messages
  }

  return (
    <div className="relative group flex items-center justify-center">
      <div className="relative">
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full font-bold cursor-help">
          {messageCount}
        </span>
      </div>
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg min-w-[300px] max-w-[400px]">
        <h4 className="font-semibold mb-2 text-sm">
          {messageCount} Chat Message{messageCount !== 1 ? 's' : ''} (Employee ID: {employeeId})
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {messages.slice(0, 5).map((message) => (
            <div key={message.id} className="border-b border-gray-700 pb-2 last:border-b-0">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-blue-300 font-medium">{message.sender}</span>
                <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">
                {message.content.length > 150 
                  ? `${message.content.substring(0, 150)}...` 
                  : message.content}
              </p>
            </div>
          ))}
          {messages.length > 5 && (
            <p className="text-xs text-gray-400 italic text-center pt-2">
              ...and {messages.length - 5} more messages
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentChatSummary;