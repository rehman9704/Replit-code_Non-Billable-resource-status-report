import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading } = useAuth();
  const [authUrl, setAuthUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Check for session info in URL (callback from Microsoft)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      setError(`Authentication failed: ${decodeURIComponent(errorParam)}`);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (sessionId && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('sessionId', sessionId);
        // This will trigger the AuthContext to verify the session
        window.location.reload();
      } catch (error) {
        setError('Authentication data processing failed');
      }
    } else {
      // Get the authentication URL from the server
      fetchAuthUrl();
    }
  }, []);

  const fetchAuthUrl = async () => {
    try {
      const response = await fetch('/api/auth/login');
      if (response.ok) {
        const data = await response.json();
        setAuthUrl(data.authUrl);
      } else {
        setError('Failed to initialize Microsoft login');
      }
    } catch (error) {
      setError('Failed to connect to authentication service');
    }
  };

  const handleCallback = async (code: string) => {
    try {
      await login(code);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Redirect to dashboard
      setLocation('/');
    } catch (error) {
      setError('Authentication failed. Please try again.');
      console.error('Login error:', error);
    }
  };

  const handleMicrosoftLogin = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-900">
            Non Billable Resource Status Report
          </CardTitle>
          <CardDescription className="text-gray-600">
            Sign in with your Microsoft account to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          
          <Button 
            onClick={handleMicrosoftLogin}
            disabled={isLoading || !authUrl}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"
                  />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </Button>

          <div className="text-xs text-gray-500 text-center">
            Access is controlled by your department and client permissions
          </div>
        </CardContent>
      </Card>
    </div>
  );
}