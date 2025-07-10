import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageCircle, Send, Search, Users, Clock, User, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface LiveChatEmployee {
  zohoId: string;
  fullName: string;
  comments?: string;
  commentsEnteredBy?: string;
  commentsUpdateDateTime?: string;
}

interface LiveChatStats {
  totalEmployees: number;
  employeesWithComments: number;
}

export default function LiveChat() {
  const [employees, setEmployees] = useState<LiveChatEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<LiveChatEmployee | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<LiveChatStats | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Load live chat statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/live-chat-sync/status', {
        headers: {
          'x-session-id': localStorage.getItem('sessionId') || ''
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setStats({
          totalEmployees: result.syncedEmployees || 0,
          employeesWithComments: result.employeesWithComments || 0
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load employees with comments
  const loadEmployeesWithComments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/live-chat-comments', {
        headers: {
          'x-session-id': localStorage.getItem('sessionId') || ''
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setEmployees(result.employees || []);
      } else {
        throw new Error('Failed to load employees');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({
        title: "Error",
        description: "Failed to load employee data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Search for specific employee by ZohoID
  const searchEmployee = async (zohoId: string) => {
    if (!zohoId.trim()) return null;
    
    try {
      const response = await fetch(`/api/live-chat-employee/${zohoId}`, {
        headers: {
          'x-session-id': localStorage.getItem('sessionId') || ''
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.employee;
      } else if (response.status === 404) {
        // Employee not in live_chat_data table yet
        return null;
      }
    } catch (error) {
      console.error('Error searching employee:', error);
    }
    return null;
  };

  // Save comment for employee
  const saveComment = async () => {
    if (!selectedEmployee || !newComment.trim() || !user?.displayName) {
      toast({
        title: "Error",
        description: "Please select an employee, enter a comment, and ensure you're logged in",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);
      
      const response = await fetch('/api/live-chat-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('sessionId') || ''
        },
        body: JSON.stringify({
          zohoId: selectedEmployee.zohoId,
          comments: newComment.trim(),
          commentsEnteredBy: user.displayName
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update selected employee data
        setSelectedEmployee(prev => prev ? ({
          ...prev,
          comments: newComment.trim(),
          commentsEnteredBy: user.displayName,
          commentsUpdateDateTime: new Date().toISOString()
        }) : null);

        setNewComment("");
        setDialogOpen(false);
        
        // Reload data
        await loadEmployeesWithComments();
        await loadStats();
        
        toast({
          title: "Success",
          description: `Comment saved for ${selectedEmployee.fullName}`,
        });
      } else {
        throw new Error(result.message || 'Failed to save comment');
      }
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: "Error",
        description: "Failed to save comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle employee search and add to chat system
  const handleEmployeeSearch = async () => {
    if (!searchTerm.trim()) return;
    
    const employee = await searchEmployee(searchTerm);
    if (employee) {
      setSelectedEmployee(employee);
      setDialogOpen(true);
    } else {
      // Create new employee entry for chat
      const newEmployee: LiveChatEmployee = {
        zohoId: searchTerm,
        fullName: `Employee ${searchTerm}`,
        comments: undefined,
        commentsEnteredBy: undefined,
        commentsUpdateDateTime: undefined
      };
      setSelectedEmployee(newEmployee);
      setDialogOpen(true);
    }
  };

  useEffect(() => {
    loadStats();
    loadEmployeesWithComments();
  }, []);

  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.zohoId.includes(searchTerm)
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Live Chat System</h1>
        <p className="text-gray-600">Manage employee comments using the Live Chat Data table</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEmployees?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">In live chat system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Comments</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.employeesWithComments || 0}</div>
            <p className="text-xs text-muted-foreground">Have feedback comments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comment Rate</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? Math.round((stats.employeesWithComments / stats.totalEmployees) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Employees with feedback</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Add Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Employee or Add Comment
          </CardTitle>
          <CardDescription>
            Search by ZohoID or employee name to view/add comments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter ZohoID or employee name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEmployeeSearch()}
              className="flex-1"
            />
            <Button onClick={handleEmployeeSearch} disabled={!searchTerm.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employees with Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employees with Comments ({filteredEmployees.length})
          </CardTitle>
          <CardDescription>
            All employees who have received feedback comments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No employees found matching your search' : 'No employees with comments yet'}
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredEmployees.map((employee) => (
                  <div key={employee.zohoId} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{employee.fullName}</h3>
                        <p className="text-sm text-gray-600">ZohoID: {employee.zohoId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Has Comments
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setDialogOpen(true);
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                    
                    {employee.comments && (
                      <div className="mt-3 p-3 bg-white border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">
                            {employee.commentsEnteredBy}
                          </span>
                          {employee.commentsUpdateDateTime && (
                            <span className="text-xs text-gray-500">
                              {format(new Date(employee.commentsUpdateDateTime), 'MMM d, yyyy h:mm a')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {employee.comments}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Comment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              {selectedEmployee?.fullName} - Live Chat
            </DialogTitle>
            <div className="text-sm text-gray-600">
              ZohoID: {selectedEmployee?.zohoId}
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Current Comments */}
            <div className="flex-1 min-h-0">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Current Comments</h3>
              <ScrollArea className="h-40 border rounded-lg p-3 bg-gray-50">
                {selectedEmployee?.comments ? (
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {selectedEmployee.commentsEnteredBy}
                      </span>
                      {selectedEmployee.commentsUpdateDateTime && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {format(new Date(selectedEmployee.commentsUpdateDateTime), 'MMM d, yyyy h:mm a')}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {selectedEmployee.comments}
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    No comments yet for {selectedEmployee?.fullName}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Add New Comment */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Add New Comment</h3>
              <div className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Enter your comment about ${selectedEmployee?.fullName}...`}
                  className="min-h-20 resize-none"
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {user?.displayName ? `Commenting as: ${user.displayName}` : 'Please log in to comment'}
                  </div>
                  <Button
                    onClick={saveComment}
                    disabled={!newComment.trim() || isSaving || !user?.displayName}
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
    </div>
  );
}