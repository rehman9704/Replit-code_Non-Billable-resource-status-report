import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      fetchEmployeeData();
    }
  }, [open, zohoId]);

  const hasComments = employeeData?.comments && employeeData.comments.trim() !== '';
  const hasChatHistory = employeeData?.chatHistory && employeeData.chatHistory.length > 0;
  
  // Enhanced debugging for chat history display
  console.log(`🔍 LiveChat UI: ${employeeName} - hasComments: ${hasComments}, hasChatHistory: ${hasChatHistory}`);
  console.log(`🔍 LiveChat UI: ${employeeName} - chatHistory:`, employeeData?.chatHistory);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 p-2 hover:bg-gray-100 border border-gray-200 rounded-full"
          title={`Chat with ${employeeName}`}
        >
          <MessageCircle className="h-4 w-4 text-gray-600" />
          {showCommentCount && (hasComments || hasChatHistory) && (
            <Badge variant="secondary" className="ml-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] rounded-full flex items-center justify-center p-0">
              {employeeData?.chatHistory?.length || 1}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-[600px] p-0 gap-0 bg-white border-gray-200">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{employeeName}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-white hover:bg-blue-700 p-1 h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
              <div className="text-gray-900">{cost ? Math.round(cost).toLocaleString() : 'N/A'}</div>
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
  );
};

export default LiveChatDialog;