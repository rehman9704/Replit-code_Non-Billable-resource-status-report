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
    <div className="absolute top-0 right-0 -mt-1 -mr-1 group z-30">
      <div className="relative">
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full font-bold cursor-help shadow-lg">
          {messageCount}
        </span>
      </div>
      
      {/* Tooltip on hover - positioned to the left, matching production style */}
      <div className="absolute top-0 right-full mr-2 hidden group-hover:block z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[350px] max-w-[450px]">
        {/* Blue header matching production */}
        <div className="bg-blue-600 text-white px-4 py-2 rounded-t-lg">
          <h4 className="font-semibold text-sm">
            Recent Comments - Employee ID {employeeId}
          </h4>
        </div>
        
        {/* White content area */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {messages.slice(0, 5).map((message, index) => (
            <div key={message.id} className="mb-4 last:mb-0">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium text-gray-800">{message.sender}</span>
                <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-2 rounded">
                {message.content.length > 200 
                  ? `${message.content.substring(0, 200)}...` 
                  : message.content}
              </p>
              {index < Math.min(messages.length, 5) - 1 && (
                <hr className="mt-3 border-gray-200" />
              )}
            </div>
          ))}
          {messages.length > 5 && (
            <div className="text-center pt-3 border-t border-gray-200">
              <p className="text-xs text-blue-600 underline cursor-pointer">
                Click to view all {messages.length} comments
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentChatSummary;