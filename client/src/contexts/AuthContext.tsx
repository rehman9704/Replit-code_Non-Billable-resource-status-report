import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  email: string;
  displayName: string;
  hasFullAccess: boolean;
  allowedDepartments: string[];
  allowedClients: string[];
}

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!sessionId;

  useEffect(() => {
    // Check for existing session in localStorage
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      verifySession(storedSessionId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifySession = async (sessionId: string) => {
    try {
      const response = await fetch('/api/auth/user', {
        headers: {
          'x-session-id': sessionId
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Session expired or invalid - clear everything and stop retrying
        setUser(null);
        setSessionId(null);
        localStorage.removeItem('sessionId');
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      setUser(null);
      setSessionId(null);
      localStorage.removeItem('sessionId');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (code: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setSessionId(data.sessionId);
        localStorage.setItem('sessionId', data.sessionId);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      if (sessionId) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'x-session-id': sessionId
          }
        });
      }
      
      // Clear state immediately
      setUser(null);
      setSessionId(null);
      localStorage.removeItem('sessionId');
      
      // Force hard reload to login page
      window.location.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setUser(null);
      setSessionId(null);
      localStorage.removeItem('sessionId');
      window.location.replace('/');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      sessionId,
      login,
      logout,
      isLoading,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}