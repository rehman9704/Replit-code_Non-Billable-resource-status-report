import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { employeeFilterSchema, chatMessages, insertChatMessageSchema, userSessions, insertUserSessionSchema, type UserSession } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer, WebSocket } from 'ws';
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { getAuthUrl, handleCallback, getUserInfo, getUserPermissions, filterEmployeesByPermissions } from "./auth";
import crypto from 'crypto';

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
    return res.status(401).json({ error: 'Invalid session' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.get("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const authUrl = await getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authentication URL' });
    }
  });

  // Handle Microsoft OAuth callback (GET route for redirect)
  app.get("/auth/callback", async (req: Request, res: Response) => {
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
      res.redirect(`/dashboard/?sessionId=${sessionId}&user=${encodeURIComponent(JSON.stringify({
        email: permissions.userEmail,
        displayName: userInfo.displayName,
        hasFullAccess: permissions.hasFullAccess,
        allowedDepartments: permissions.allowedDepartments,
        allowedClients: permissions.allowedClients
      }))}`);
    } catch (error) {
      console.error('Authentication callback error:', error);
      res.redirect(`/dashboard/?error=${encodeURIComponent('Authentication failed')}`);
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
          allowedClients: permissions.allowedClients
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
      allowedClients: user.allowedClients
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
    try {
      // Process query parameters
      const department = req.query.department as string;
      const billableStatus = req.query.billableStatus as string;
      const businessUnit = req.query.businessUnit as string;
      const client = req.query.client as string;
      const project = req.query.project as string;
      const timesheetAging = req.query.timesheetAging as string;
      
      const filterParams = {
        department: department === 'all' ? '' : department,
        billableStatus: billableStatus === 'all' ? '' : billableStatus,
        businessUnit: businessUnit === 'all' ? '' : businessUnit,
        client: client === 'all' ? '' : client,
        project: project === 'all' ? '' : project,
        timesheetAging: timesheetAging === 'all' ? '' : timesheetAging,
        search: req.query.search as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined
      };

      // Validate the filter parameters
      const validationResult = employeeFilterSchema.safeParse(filterParams);
      
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        return res.status(400).json({ message: errorMessage.message });
      }

      const result = await storage.getEmployees(filterParams);
      
      // Apply SharePoint-based access control
      const user = req.user!;
      const permissions = {
        hasFullAccess: user.hasFullAccess,
        allowedDepartments: user.allowedDepartments,
        allowedClients: user.allowedClients,
        userEmail: user.userEmail
      };
      
      const filteredEmployees = filterEmployeesByPermissions(result.data, permissions);
      
      res.json({
        ...result,
        data: filteredEmployees,
        total: filteredEmployees.length
      });
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

  // Get filter options for dropdown menus (requires auth)
  app.get("/api/filter-options", requireAuth, async (_req: Request & { user?: UserSession }, res: Response) => {
    try {
      const filterOptions = await storage.getFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Get chat messages for a specific employee
  app.get("/api/chat-messages/:employeeId", async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "Invalid employee ID" });
      }

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.employeeId, employeeId))
        .orderBy(desc(chatMessages.timestamp));

      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // Save a new chat message
  app.post("/api/chat-messages", async (req: Request, res: Response) => {
    try {
      const result = insertChatMessageSchema.safeParse(req.body);
      if (!result.success) {
        const errorMessage = fromZodError(result.error);
        return res.status(400).json({ error: errorMessage.toString() });
      }

      const [newMessage] = await db
        .insert(chatMessages)
        .values(result.data)
        .returning();

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error saving chat message:", error);
      res.status(500).json({ error: "Failed to save chat message" });
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
        
        // Save message to database
        try {
          const result = await db.insert(chatMessages).values({
            employeeId: message.employeeId,
            sender: message.sender,
            content: message.content,
          }).returning();
          console.log('Message saved to database successfully:', result[0]);
        } catch (dbError) {
          console.error('Error saving message to database:', dbError);
        }
        
        // Broadcast message to all clients in the same room
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
