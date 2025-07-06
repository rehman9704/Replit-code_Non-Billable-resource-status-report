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
        setLoading(true);
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
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    
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

  if (loading) {
    return <span className="text-xs text-gray-400">Loading...</span>;
  }

  if (messageCount === 0) {
    return <span className="text-xs text-gray-400">No messages</span>;
  }

  return (
    <div className="relative group">
      <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-medium cursor-help">
        {messageCount} message{messageCount !== 1 ? 's' : ''}
      </span>
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg min-w-[300px] max-w-[400px]">
        <h4 className="font-semibold mb-2 text-sm">Recent Chat Messages</h4>
        <div className="space-y-2">
          {messages.slice(0, 3).map((message) => (
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