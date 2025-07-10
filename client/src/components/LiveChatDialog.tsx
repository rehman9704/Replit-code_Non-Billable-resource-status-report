import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, User, Clock } from 'lucide-react';
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
}

interface LiveChatComment {
  zohoId: string;
  fullName: string;
  comments?: string;
  commentsEnteredBy?: string;
  commentsUpdateDateTime?: string;
}

export const LiveChatDialog: React.FC<LiveChatDialogProps> = ({
  zohoId,
  employeeName,
  employeeId,
  department,
  buttonText = "Chat",
  showCommentCount = true
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
      
      const response = await fetch(`/api/live-chat-employee/${zohoId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-session-id': localStorage.getItem('sessionId') || ''
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.employee) {
          setEmployeeData(result.employee);
          console.log(`✅ LiveChat: Found data for ${employeeName}:`, result.employee);
        } else {
          // Employee exists in live_chat_data but no comments yet
          setEmployeeData({
            zohoId,
            fullName: employeeName,
            comments: undefined,
            commentsEnteredBy: undefined,
            commentsUpdateDateTime: undefined
          });
          console.log(`📝 LiveChat: ${employeeName} ready for comments (no existing comments)`);
        }
      } else if (response.status === 404) {
        // Employee not in live_chat_data table yet - this is normal for new employees
        console.log(`⚠️ LiveChat: ${employeeName} (ZohoID: ${zohoId}) not in live_chat_data table yet`);
        setEmployeeData(null);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ LiveChat: Error fetching data for ${employeeName}:`, error);
      setEmployeeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Save new comment
  const saveComment = async () => {
    if (!newComment.trim() || !user?.displayName) {
      toast({
        title: "Error",
        description: "Please enter a comment and ensure you're logged in",
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
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('sessionId') || ''
        },
        body: JSON.stringify({
          zohoId,
          comments: newComment.trim(),
          commentsEnteredBy: user.displayName
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ LiveChat: Comment saved for ${employeeName}`);
        
        // Update local state
        setEmployeeData(prev => ({
          zohoId,
          fullName: employeeName,
          comments: newComment.trim(),
          commentsEnteredBy: user.displayName,
          commentsUpdateDateTime: new Date().toISOString(),
          ...prev
        }));

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2 hover:bg-blue-50 border-blue-200"
        >
          <MessageCircle className="h-4 w-4" />
          {buttonText}
          {showCommentCount && hasComments && (
            <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800">
              1
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Live Chat - {employeeName}
          </DialogTitle>
          <div className="text-sm text-gray-600">
            ZohoID: {zohoId} 
            {department && ` • ${department}`}
            {employeeId && ` • ID: ${employeeId}`}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Current Comments Section */}
          <div className="flex-1 min-h-0">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Current Comments</h3>
            <ScrollArea className="h-40 border rounded-lg p-3 bg-gray-50">
              {isLoading ? (
                <div className="text-center text-gray-500 py-8">
                  Loading comments...
                </div>
              ) : hasComments ? (
                <div className="space-y-3">
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {employeeData.commentsEnteredBy}
                      </span>
                      {employeeData.commentsUpdateDateTime && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {format(new Date(employeeData.commentsUpdateDateTime), 'MMM d, yyyy h:mm a')}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {employeeData.comments}
                    </p>
                  </div>
                </div>
              ) : employeeData ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  No comments yet for {employeeName}
                </div>
              ) : (
                <div className="text-center text-orange-600 py-8">
                  <div className="font-medium">Employee Not in Live Chat System</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {employeeName} (ZohoID: {zohoId}) will be available when they appear in the dashboard report
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Add New Comment Section */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Add New Comment</h3>
            <div className="space-y-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={`Enter your comment about ${employeeName}...`}
                className="min-h-20 resize-none"
                disabled={!employeeData}
              />
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  {user?.displayName ? `Commenting as: ${user.displayName}` : 'Please log in to comment'}
                </div>
                <Button
                  onClick={saveComment}
                  disabled={!newComment.trim() || isSaving || !employeeData || !user?.displayName}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Comment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LiveChatDialog;