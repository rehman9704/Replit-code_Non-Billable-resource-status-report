import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Login: React.FC = () => {
  const handleLogin = () => {
    // Redirect to Azure AD authentication
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Non Billable Resource Status Report
          </CardTitle>
          <CardDescription>
            Royal Cyber Finance Management Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Please sign in with your Royal Cyber credentials to access the employee timesheet dashboard.
            </p>
            <Button 
              onClick={handleLogin}
              className="w-full"
              size="lg"
            >
              Sign in with Microsoft
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;