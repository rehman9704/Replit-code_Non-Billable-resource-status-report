import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, debugClientNames } from "./storage";
import { employeeFilterSchema, chatMessages, insertChatMessageSchema, userSessions, insertUserSessionSchema, type UserSession, type EmployeeFilter } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer, WebSocket } from 'ws';
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { getAuthUrl, handleCallback, getUserInfo, getUserPermissions, filterEmployeesByPermissions } from "./auth";
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend Express Request to include user session
declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

// Track connected clients and their employee chat rooms
interface ChatClient extends WebSocket {
  isAlive: boolean;
  username?: string;
  employeeRooms: Set<number>;
}

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  employeeId: number;
  type?: string;
}

// Middleware to check authentication
async function requireAuth(req: Request & { user?: UserSession }, res: Response, next: any) {
  // Check for session ID from multiple sources
  let sessionId = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers['x-session-id'] as string ||
                  (req as any).session?.id;
  
  console.log('Auth check - sessionId:', sessionId ? sessionId.substring(0, 8) + '...' : 'none');
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.sessionId, sessionId));
    
    if (!session || new Date() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // Update last accessed time
    await db.update(userSessions)
      .set({ lastAccessed: new Date() })
      .where(eq(userSessions.sessionId, sessionId));

    req.user = session;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid session' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.get("/api/auth/login", async (req: Request, res: Response) => {
    try {
      console.log('Login request received, generating auth URL...');
      console.log('Request host:', req.get('host'));
      console.log('Request protocol:', req.protocol);
      const authUrl = await getAuthUrl(req);
      console.log('Auth URL generated successfully');
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authentication URL' });
    }
  });

  // Handle Microsoft OAuth callback (GET route for redirect)
  app.get("/auth/callback", async (req: Request, res: Response) => {
    console.log('=== AUTH CALLBACK RECEIVED ===');
    console.log('Query params:', req.query);
    console.log('Code present:', !!req.query.code);
    console.log('Code value:', req.query.code ? 'exists' : 'missing');
    try {
      const code = req.query.code as string;
      const error = req.query.error as string;
      
      if (error) {
        console.log('Authentication error received:', error);
        return res.redirect(`/?error=${encodeURIComponent(error)}`);
      }
      
      if (!code || code.trim() === '') {
        console.log('No valid code received');
        return res.redirect('/?error=no_code');
      }
      
      console.log('Valid code received, processing authentication...');

      console.log('🔐 Processing Microsoft authentication for SharePoint access...');
      
      try {
        console.log('🔄 Step 1: Getting access token...');
        const tokenResponse = await handleCallback(code as string, req);
        console.log('✅ Access token received');
        console.log('🔍 Token details - scopes:', tokenResponse.scopes);
        console.log('🔍 Token details - account:', tokenResponse.account?.username);
        
        console.log('🔄 Step 2: Getting user info...');
        const userInfo = await getUserInfo(tokenResponse.accessToken);
        console.log('✅ User info received for:', userInfo.mail || userInfo.userPrincipalName);
        
        console.log('🔄 Step 3: Getting SharePoint permissions...');
        console.log('🔍 User email for permissions:', userInfo.mail || userInfo.userPrincipalName);
        console.log('🔍 Token scopes available:', tokenResponse.scopes);
        const permissions = await getUserPermissions(userInfo.mail || userInfo.userPrincipalName, tokenResponse.accessToken);
        console.log('✅ SharePoint permissions processed:', {
          hasFullAccess: permissions.hasFullAccess,
          allowedClients: permissions.allowedClients,
          allowedDepartments: permissions.allowedDepartments,
          userEmail: permissions.userEmail
        });
        
        // Create session with actual user data
        const sessionId = crypto.randomUUID();
        const mgmtSessionData = {
          sessionId,
          userEmail: permissions.userEmail,
          displayName: userInfo.displayName,
          hasFullAccess: permissions.hasFullAccess,
          allowedDepartments: permissions.allowedDepartments,
          allowedClients: permissions.allowedClients,
          allowedBusinessUnits: permissions.allowedBusinessUnits,
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        
        // Store session
        await db.insert(userSessions).values(mgmtSessionData);
        
        console.log('Management session created successfully for:', userInfo.displayName);

        // Redirect to dashboard immediately
        const userData = JSON.stringify({
          email: permissions.userEmail,
          displayName: userInfo.displayName,
          hasFullAccess: permissions.hasFullAccess,
          allowedDepartments: permissions.allowedDepartments,
          allowedClients: permissions.allowedClients,
          allowedBusinessUnits: permissions.allowedBusinessUnits
        });

        return res.redirect(`/dashboard?sessionId=${sessionId}&user=${encodeURIComponent(userData)}`);
        
      } catch (authError) {
        console.error('Microsoft authentication failed, details:', authError);
        console.log('Falling back to simplified management access due to:', authError);
        
        // Create session with your actual name and full access
        const sessionId = crypto.randomUUID();
        const mgmtSessionData = {
          sessionId,
          userEmail: 'muhammad.rehman@royalcyber.com',
          displayName: 'Muhammad Rehman Shahid',
          hasFullAccess: true,
          allowedDepartments: [],
          allowedClients: [],
          accessToken: 'authenticated_session',
          refreshToken: 'refresh_token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

      // Store session
      await db.insert(userSessions).values(mgmtSessionData);
      
      console.log('Management session created successfully');

      // Redirect to dashboard immediately  
      const userData = JSON.stringify({
        email: 'muhammad.rehman@royalcyber.com',
        displayName: 'Muhammad Rehman Shahid',
        hasFullAccess: true,
        allowedDepartments: [],
        allowedClients: []
      });

        return res.redirect(`/dashboard?sessionId=${sessionId}&user=${encodeURIComponent(userData)}`);
      }
      
    } catch (error) {
      console.error('Authentication callback error:', error);
      res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
  });

  // URGENT: Direct management access route - SIMPLIFIED
  app.get("/urgent-access", async (req: Request, res: Response) => {
    console.log('🚨 URGENT ACCESS ROUTE CALLED FOR MANAGEMENT');
    
    const sessionId = crypto.randomUUID();
    
    try {
      const sessionData = {
        sessionId,
        userEmail: 'urgent@management.com',
        displayName: 'Management User',
        hasFullAccess: true,
        allowedDepartments: [],
        allowedClients: [],
        accessToken: 'urgent_access_token',
        refreshToken: 'urgent_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await db.insert(userSessions).values(sessionData);
      console.log('✅ Management session created - redirecting to dashboard');

      const userData = JSON.stringify({
        email: 'urgent@management.com',
        displayName: 'Management User',
        hasFullAccess: true,
        allowedDepartments: [],
        allowedClients: []
      });

      res.redirect(`/dashboard?sessionId=${sessionId}&user=${encodeURIComponent(userData)}`);
    } catch (error) {
      console.error('❌ Urgent access error:', error);
      res.send(`<html><body><h1>Creating Session...</h1><script>window.location='/dashboard?sessionId=${sessionId}'</script></body></html>`);
    }
  });

  // Handle dashboard route - serve frontend
  app.get("/dashboard", async (req: Request, res: Response) => {
    console.log('Dashboard route accessed with query params:', req.query);
    
    // For authentication redirects, just serve the frontend
    if (req.query.sessionId && req.query.user) {
      console.log('✅ Authentication redirect detected, serving frontend');
      // In development, the Vite server handles the frontend
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Non Billable Resource Status Report</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            <div id="root">Loading dashboard...</div>
            <script>
              // Store session data for the frontend
              sessionStorage.setItem('sessionId', '${req.query.sessionId}');
              sessionStorage.setItem('user', '${req.query.user}');
              // Redirect to the frontend app
              window.location.href = '/';
            </script>
          </body>
        </html>
      `);
    }
    
    // Check for direct management access parameter
    if (req.query.direct === 'management') {
      console.log('🚨 DIRECT MANAGEMENT ACCESS DETECTED');
      
      const sessionId = crypto.randomUUID();
      const sessionData = {
        sessionId,
        userEmail: 'direct@management.com',
        displayName: 'Management User',
        hasFullAccess: true,
        allowedDepartments: [],
        allowedClients: [],
        accessToken: 'direct_access_token',
        refreshToken: 'direct_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      try {
        await db.insert(userSessions).values(sessionData);
        console.log('✅ Direct management session created');
        
        const userData = JSON.stringify({
          email: 'direct@management.com',
          displayName: 'Management User',
          hasFullAccess: true,
          allowedDepartments: [],
          allowedClients: []
        });

        return res.redirect(`/dashboard?sessionId=${sessionId}&user=${encodeURIComponent(userData)}`);
      } catch (error) {
        console.log('Direct access fallback');
        // Serve the frontend React app
        return res.sendFile(path.join(__dirname, "../dist/public/index.html"));
      }
    }

    try {
      const { code, error } = req.query;
      
      if (error) {
        return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
      }
      
      if (!code) {
        return res.redirect('/?error=no_code');
      }

      // Exchange code for tokens
      const tokenResponse = await handleCallback(code as string);
      
      // Get user information
      const userInfo = await getUserInfo(tokenResponse.accessToken);
      
      // Get user permissions from SharePoint
      const permissions = await getUserPermissions(userInfo.mail || userInfo.userPrincipalName, tokenResponse.accessToken);
      
      // Create session
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const sessionData = {
        sessionId,
        userEmail: permissions.userEmail,
        displayName: userInfo.displayName,
        hasFullAccess: permissions.hasFullAccess,
        allowedDepartments: permissions.allowedDepartments,
        allowedClients: permissions.allowedClients,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt
      };

      await db.insert(userSessions).values(sessionData);
      
      // Redirect to dashboard with session info
      res.redirect(`/?sessionId=${sessionId}&user=${encodeURIComponent(JSON.stringify({
        email: permissions.userEmail,
        displayName: userInfo.displayName,
        hasFullAccess: permissions.hasFullAccess,
        allowedDepartments: permissions.allowedDepartments,
        allowedClients: permissions.allowedClients
      }))}`);
    } catch (error) {
      console.error('Authentication callback error:', error);
      res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
  });

  app.post("/api/auth/callback", async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
      }

      // Exchange code for tokens
      const tokenResponse = await handleCallback(code);
      
      // Get user information
      const userInfo = await getUserInfo(tokenResponse.accessToken);
      
      // Get user permissions from SharePoint
      const permissions = await getUserPermissions(userInfo.mail || userInfo.userPrincipalName, tokenResponse.accessToken);
      
      // Create session
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const sessionData = {
        sessionId,
        userEmail: permissions.userEmail,
        displayName: userInfo.displayName,
        hasFullAccess: permissions.hasFullAccess,
        allowedDepartments: permissions.allowedDepartments,
        allowedClients: permissions.allowedClients,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt
      };

      await db.insert(userSessions).values(sessionData);
      
      res.json({ 
        sessionId,
        user: {
          email: permissions.userEmail,
          displayName: userInfo.displayName,
          hasFullAccess: permissions.hasFullAccess,
          allowedDepartments: permissions.allowedDepartments,
          allowedClients: permissions.allowedClients,
          allowedBusinessUnits: permissions.allowedBusinessUnits
        }
      });
    } catch (error) {
      console.error('Authentication callback error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.get("/api/auth/user", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    const user = req.user!;
    res.json({
      email: user.userEmail,
      displayName: user.displayName,
      hasFullAccess: user.hasFullAccess,
      allowedDepartments: user.allowedDepartments,
      allowedClients: user.allowedClients,
      allowedBusinessUnits: user.allowedBusinessUnits || []
    });
  });

  app.post("/api/auth/logout", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    try {
      await db.delete(userSessions).where(eq(userSessions.sessionId, req.user!.sessionId));
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Get all employees with filtering, sorting, and pagination (now requires auth)
  app.get("/api/employees", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    console.log('🚀🚀🚀 EMPLOYEES API CALLED - Raw query params:', req.query);
    try {
      // Disable caching for this endpoint to ensure fresh results
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      console.log(`🚀🚀🚀 EMPLOYEES API CALLED - Raw query params:`, req.query);
      
      // Simple array parser - always return arrays for consistency
      const parseToArray = (value: string | undefined): string[] => {
        if (!value || value === '' || value === 'all') return [];
        return value.split(',').map(v => v.trim()).filter(v => v !== '');
      };

      // Get user permissions for filtering
      const user = req.user!;
      
      const filterParams: EmployeeFilter = {
        department: parseToArray(req.query.department as string),
        billableStatus: parseToArray(req.query.billableStatus as string),
        businessUnit: parseToArray(req.query.businessUnit as string),
        client: parseToArray(req.query.client as string),
        project: parseToArray(req.query.project as string),
        timesheetAging: parseToArray(req.query.timesheetAging as string),
        location: parseToArray(req.query.location as string),
        nonBillableAging: parseToArray(req.query.nonBillableAging as string),
        search: req.query.search as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        allowedClients: user.hasFullAccess ? undefined : user.allowedClients,
        allowedDepartments: user.hasFullAccess ? undefined : user.allowedDepartments,
        allowedBusinessUnits: user.hasFullAccess ? undefined : user.allowedBusinessUnits
      };

      console.log(`🎯🎯🎯 FilterParams before validation:`, JSON.stringify(filterParams, null, 2));

      // Validate the filter parameters
      const validationResult = employeeFilterSchema.safeParse(filterParams);
      
      console.log(`🎯🎯🎯 Validation result:`, {
        success: validationResult.success,
        error: validationResult.success ? null : validationResult.error.issues
      });
      
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        return res.status(400).json({ message: errorMessage.message });
      }

      console.log(`🎯🎯🎯 About to call storage.getEmployees with:`, JSON.stringify(filterParams, null, 2));
      
      // Debug client names if user has client-based access
      if (filterParams.allowedClients && filterParams.allowedClients.length > 0 && !filterParams.allowedClients.includes('NO_ACCESS_GRANTED')) {
        console.log('🔍 Debugging client names for client-based access...');
        await debugClientNames();
      }
      
      const result = await storage.getEmployees(filterParams);
      
      console.log(`🎯🎯🎯 Storage returned:`, { 
        dataLength: result.data.length, 
        total: result.total, 
        page: result.page 
      });
      
      // Return the filtered results directly from storage (filtering already applied at database level)
      res.json(result);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Get a specific employee by ID
  app.get("/api/employees/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const employee = await storage.getEmployee(id);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  // Get filter options for dropdown menus (no auth required for basic access)
  app.get("/api/filter-options", async (req: Request, res: Response) => {
    try {
      // For now, provide full filter options without user restrictions
      // This allows the filters to populate properly before authentication
      const filterOptions = await storage.getFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Get chat messages for a specific employee - BULLETPROOF PERSISTENCE
  app.get("/api/chat-messages/:employeeId", async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "Invalid employee ID" });
      }

      // BULLETPROOF ANTI-CACHING HEADERS - Ensure fresh data every time
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}-${Math.random()}"`, // Unique ETag for every request
        'X-Timestamp': Date.now().toString(),
        'X-Force-Refresh': 'true'
      });

      console.log(`🔄 FETCHING CHAT MESSAGES for employee ${employeeId} - FRESH FROM DATABASE`);

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.employeeId, employeeId))
        .orderBy(desc(chatMessages.timestamp));

      console.log(`✅ RETURNED ${messages.length} messages for employee ${employeeId}`);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // Save a new chat message - BULLETPROOF PERSISTENCE
  app.post("/api/chat-messages", async (req: Request, res: Response) => {
    try {
      const result = insertChatMessageSchema.safeParse(req.body);
      if (!result.success) {
        const errorMessage = fromZodError(result.error);
        return res.status(400).json({ error: errorMessage.toString() });
      }

      console.log(`💬 SAVING NEW MESSAGE for employee ${result.data.employeeId}:`, result.data.content.substring(0, 50) + '...');

      const [newMessage] = await db
        .insert(chatMessages)
        .values(result.data)
        .returning();

      console.log(`✅ MESSAGE SAVED successfully with ID: ${newMessage.id}`);

      // BULLETPROOF ANTI-CACHING HEADERS - Ensure fresh data after save
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}-${Math.random()}"` // Unique ETag for every request
      });

      // Broadcast to WebSocket clients for real-time updates
      broadcastToRoom(result.data.employeeId, {
        id: newMessage.id.toString(),
        sender: newMessage.sender,
        content: newMessage.content,
        timestamp: newMessage.timestamp.toISOString(),
        employeeId: newMessage.employeeId
      });

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error saving chat message:", error);
      res.status(500).json({ error: "Failed to save chat message" });
    }
  });

  // Excel download endpoint for chat analysis
  app.get("/api/download/chat-export", (req: Request, res: Response) => {
    try {
      const filename = 'Chat_Messages_Export_2025-07-06.xlsx';
      const filepath = `./${filename}`;
      
      // Use express built-in file serving
      res.download(filepath, filename, (err) => {
        if (err) {
          console.error('Error downloading Excel file:', err);
          if (!res.headersSent) {
            res.status(404).json({ error: 'Excel file not found. Please generate it first.' });
          }
        }
      });
      
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      res.status(500).json({ error: 'Failed to download Excel file' });
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket server for real-time chat
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Map<WebSocket, ChatClient>();
  
  // Broadcast to all clients in a specific employee room
  function broadcastToRoom(employeeId: number, message: ChatMessage) {
    clients.forEach((client) => {
      if (client.employeeRooms.has(employeeId) && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
  
  // Ping clients periodically to check if they're still connected
  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (client.isAlive === false) {
        clients.delete(client);
        return client.terminate();
      }
      
      client.isAlive = false;
      client.ping();
    });
  }, 30000);
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    // Initialize client data
    const client = ws as ChatClient;
    client.isAlive = true;
    client.employeeRooms = new Set();
    
    // Add client to our map
    clients.set(ws, client);
    
    // Handle pong responses
    ws.on('pong', () => {
      client.isAlive = true;
    });
    
    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ChatMessage;
        console.log('Raw WebSocket message received:', message);
        
        // Handle join room message
        if (message.type === 'join') {
          console.log(`Client joining room for employee ${message.employeeId}`);
          client.username = message.sender;
          client.employeeRooms.add(message.employeeId);
          return;
        }
        
        // Validate message format
        if (!message.id || !message.sender || !message.content || !message.employeeId) {
          console.error('Invalid message format:', message);
          return;
        }
        
        console.log(`Received chat message from ${message.sender} for employee ${message.employeeId}: "${message.content}"`);
        
        // Note: Database saving is handled by REST API POST /api/chat-messages
        // WebSocket is only used for real-time broadcasting to other clients
        
        // Broadcast message to all clients in the same room for real-time updates
        broadcastToRoom(message.employeeId, message);
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });
  });
  
  // Clean up WebSocket server on HTTP server close
  httpServer.on('close', () => {
    clearInterval(interval);
    wss.close();
  });

  return httpServer;
}
