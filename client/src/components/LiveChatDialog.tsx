import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface LiveChatDialogProps {
  zohoId: string;
  employeeName: string;
  employeeId?: string;
  department?: string;
  buttonText?: string;
  showCommentCount?: boolean;
  // Real employee data from the main table
  status?: string;
  cost?: number;
  nonBillableAging?: string;
  client?: string;
}

interface LiveChatComment {
  zohoId: string;
  fullName: string;
  comments?: string;
  commentsEnteredBy?: string;
  commentsUpdateDateTime?: string;
  chatHistory?: Array<{
    message: string;
    sentBy: string;
    timestamp: string;
    messageType: string;
  }>;
}

export const LiveChatDialog: React.FC<LiveChatDialogProps> = ({
  zohoId,
  employeeName,
  employeeId,
  department,
  buttonText = "Chat",
  showCommentCount = true,
  status,
  cost,
  nonBillableAging,
  client
}) => {
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [employeeData, setEmployeeData] = useState<LiveChatComment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch employee live chat data
  const fetchEmployeeData = async () => {
    if (!zohoId) return;
    
    try {
      setIsLoading(true);
      console.log(`💬 LiveChat: Fetching data for ZohoID ${zohoId} (${employeeName})`);
      
      const response = await fetch(`/api/live-chat-comments/${zohoId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log(`🔍 LiveChat FRONTEND: Raw API response for ${employeeName}:`, result);
          console.log(`🔍 LiveChat FRONTEND: Chat history array:`, result.chatHistory);
          console.log(`🔍 LiveChat FRONTEND: Chat history length:`, result.chatHistory?.length);
          
          setEmployeeData({
            zohoId: result.zohoId,
            fullName: result.fullName || employeeName,
            comments: result.comments,
            commentsEnteredBy: result.commentsEnteredBy,
            commentsUpdateDateTime: result.commentsUpdateDateTime,
            chatHistory: result.chatHistory || []
          });
          console.log(`✅ LiveChat: Found data for ${employeeName}:`, result);
        }
      }
    } catch (error) {
      console.error(`❌ LiveChat: Error fetching data for ${employeeName}:`, error);
      setEmployeeData({
        zohoId,
        fullName: employeeName,
        comments: undefined,
        commentsEnteredBy: undefined,
        commentsUpdateDateTime: undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save new comment
  const saveComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);
      console.log(`💬 LiveChat: Saving comment for ${employeeName} (ZohoID: ${zohoId})`);

      const response = await fetch('/api/live-chat-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zohoId,
          comments: newComment.trim(),
          commentsEnteredBy: user?.displayName || 'Anonymous'
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ LiveChat: Comment saved for ${employeeName}`);
        
        // Refresh data to get updated chat history
        await fetchEmployeeData();

        setNewComment("");
        
        toast({
          title: "Comment Saved",
          description: `Comment added for ${employeeName}`,
        });
      } else {
        throw new Error(result.message || 'Failed to save comment');
      }
    } catch (error) {
      console.error(`❌ LiveChat: Error saving comment for ${employeeName}:`, error);
      toast({
        title: "Error",
        description: "Failed to save comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load data immediately on component mount to show count
  useEffect(() => {
    fetchEmployeeData();
  }, [zohoId]);

  // Refresh data when dialog opens (if needed)
  useEffect(() => {
    if (open && employeeData) {
      fetchEmployeeData();
    }
  }, [open]);

  const hasComments = employeeData?.comments && employeeData.comments.trim() !== '';
  const hasChatHistory = employeeData?.chatHistory && employeeData.chatHistory.length > 0;
  
  // Enhanced debugging for chat history display
  if (employeeData) {
    console.log(`🔍 LiveChat UI: ${employeeName} - hasComments: ${hasComments}, hasChatHistory: ${hasChatHistory}`);
    console.log(`🔍 LiveChat UI: ${employeeName} - chatHistory:`, employeeData?.chatHistory);
  }

  return (
    <TooltipProvider>
      <Tooltip onOpenChange={(open) => open && !employeeData && fetchEmployeeData()}>
        <Dialog open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`p-2 border rounded-full transition-all duration-200 ${
                    !isLoading && (hasComments || hasChatHistory)
                      ? "bg-blue-600 border-blue-600 hover:bg-blue-700 shadow-md" 
                      : "bg-white border-gray-300 hover:bg-gray-50 hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  <MessageCircle className={`h-4 w-4 transition-colors duration-200 ${
                    !isLoading && (hasComments || hasChatHistory)
                      ? "text-white fill-white" 
                      : "text-gray-400 hover:text-blue-500"
                  }`} />
                </Button>
                {showCommentCount && !isLoading && (hasComments || hasChatHistory) && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] rounded-full flex items-center justify-center p-0 border-2 border-white"
                  >
                    {(() => {
                      // Chat history already contains the main comment, so just count chat history
                      const totalCount = employeeData?.chatHistory?.length || 0;
                      
                      // Debug log to verify count calculation
                      if (totalCount > 0) {
                        console.log(`🔢 LiveChat UI COUNT for ${employeeName}: chatHistory=${totalCount}, hasComments=${hasComments}, totalCount=${totalCount}`);
                      }
                      
                      return totalCount;
                    })()}
                  </Badge>
                )}
                {isLoading && showCommentCount && (
                  <div className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-gray-300 animate-pulse border-2 border-white"></div>
                )}
              </div>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-sm p-0 overflow-hidden">
            <div className="bg-blue-600 text-white px-3 py-2">
              <p className="font-semibold text-sm">Recent Comments - {employeeName}</p>
            </div>
            <div className="p-3 space-y-2">
              {isLoading ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : hasChatHistory ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {employeeData.chatHistory.slice(-3).map((message, index) => (
                    <div key={index} className="text-xs border-l-2 border-blue-200 pl-2">
                      <p className="text-gray-800 line-clamp-2">{message.message}</p>
                      <p className="text-gray-500 text-[10px]">
                        {message.sentBy} • {format(new Date(message.timestamp), 'MMM dd')}
                      </p>
                    </div>
                  ))}
                  {employeeData.chatHistory.length > 3 && (
                    <p className="text-[10px] text-blue-600 font-medium">
                      +{employeeData.chatHistory.length - 3} more messages
                    </p>
                  )}
                </div>
              ) : hasComments ? (
                <div className="text-xs border-l-2 border-blue-200 pl-2">
                  <p className="text-gray-800 line-clamp-2">{employeeData?.comments}</p>
                  <p className="text-gray-500 text-[10px]">
                    {employeeData?.commentsEnteredBy} • {employeeData?.commentsUpdateDateTime && format(new Date(employeeData.commentsUpdateDateTime), 'MMM dd')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No comments yet</p>
              )}
              <p className="text-[10px] text-gray-500 pt-1 border-t border-gray-200">
                Click to view all messages
              </p>
            </div>
          </TooltipContent>
      
      <DialogContent className="max-w-[600px] p-0 gap-0 bg-white border-gray-200">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg">
          <div className="text-lg font-semibold">{employeeName}</div>
        </div>

        {/* Employee Info Section */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 font-medium">Zoho ID</div>
              <div className="text-gray-900">{zohoId}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Department</div>
              <div className="text-gray-900">{department || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Status</div>
              <div className="text-gray-900">{status || nonBillableAging || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Cost</div>
              <div className="text-gray-900">{(() => {
                if (!cost) return 'N/A';
                
                // Handle both string and number cost values
                let numericCost;
                if (typeof cost === 'string') {
                  // Remove $ sign and commas, then parse to number
                  numericCost = parseFloat(cost.replace(/[$,]/g, ''));
                } else {
                  numericCost = cost;
                }
                
                // Check if it's a valid number and greater than 0
                if (!isNaN(numericCost) && numericCost > 0) {
                  return `$${Math.round(numericCost).toLocaleString()}`;
                }
                return 'N/A';
              })()}</div>
            </div>
          </div>
        </div>

        {/* Comments History Section */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments History</h3>
          
          <ScrollArea className="h-[200px] mb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading...</span>
              </div>
            ) : hasChatHistory ? (
              <div className="space-y-3">
                {/* Display all chat history messages (includes main comment) */}
                {employeeData.chatHistory.map((message, index) => (
                  <div key={index} className="bg-white border rounded-lg p-3">
                    <div className="text-gray-900 mb-2">
                      {message.message}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{message.sentBy}</span>
                      <span>{format(new Date(message.timestamp), 'MMM dd, yyyy, hh:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : hasComments ? (
              <div className="space-y-3">
                {/* Fallback: Display main comment if no chat history exists */}
                <div className="bg-white border rounded-lg p-3">
                  <div className="text-gray-900 mb-2">
                    {employeeData?.comments}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{employeeData?.commentsEnteredBy || 'Unknown'}</span>
                    {employeeData?.commentsUpdateDateTime && (
                      <span>{format(new Date(employeeData.commentsUpdateDateTime), 'MMM dd, yyyy, hh:mm a')}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No comments yet</p>
              </div>
            )}
          </ScrollArea>

          {/* Add Comment Section */}
          <div className="space-y-3">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[80px] resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              disabled={isSaving}
            />
            <div className="flex justify-end">
              <Button 
                onClick={saveComment}
                disabled={!newComment.trim() || isSaving}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  "Add Comment"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
        </Dialog>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LiveChatDialog;