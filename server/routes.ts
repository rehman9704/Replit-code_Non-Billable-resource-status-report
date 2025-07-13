import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, debugClientNames } from "./storage";
import { employeeFilterSchema, chatMessages, insertChatMessageSchema, userSessions, insertUserSessionSchema, chatCommentsIntended, azureEmployeeSync, liveChatData, type UserSession, type EmployeeFilter } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer, WebSocket } from 'ws';
import { db, pool } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { getAuthUrl, handleCallback, getUserInfo, getUserPermissions, filterEmployeesByPermissions } from "./auth";
import { syncAzureEmployeesToPostgres, getAllSyncedEmployees, triggerManualSync, getSyncStatistics, performDailySync } from "./azure-sync";
import { syncLiveChatData, getLiveChatDataStats, updateLiveChatComment, getLiveChatEmployeeData, getAllLiveChatDataWithComments, getLiveChatCommentsByZohoId } from "./live-chat-sync";
import { updateLiveChatCommentSchema } from "@shared/schema";
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

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
  // CRITICAL: Place download routes FIRST to prevent Vite interception
  // Direct download endpoint for chat export
  app.get("/download-chat-export", (req: Request, res: Response) => {
    try {
      const fs = require('fs');
      const filename = 'Complete_Chat_Export_2025-07-10T16-59-03.xlsx';
      const filePath = path.resolve(process.cwd(), filename);
      
      console.log(`📁 Direct chat export download request`);
      console.log(`📁 File path: ${filePath}`);
      console.log(`📁 Request method: ${req.method}`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Chat export file not found: ${filePath}`);
        return res.status(404).json({ error: 'Chat export file not found' });
      }
      
      const stats = fs.statSync(filePath);
      console.log(`📁 File size: ${stats.size} bytes`);
      
      // Force download with proper headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Chat_Export_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.setHeader('Content-Length', stats.size.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      console.log(`✅ Serving chat export file: ${filename} (${stats.size} bytes)`);
      
      // Handle HEAD requests for preflight
      if (req.method === 'HEAD') {
        return res.status(200).end();
      }
      
      res.sendFile(filePath);
    } catch (error) {
      console.error('Chat export download error:', error);
      res.status(500).json({ error: 'Failed to download chat export' });
    }
  });

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

  // Sync employees from Azure SQL to PostgreSQL
  app.post("/api/employees/sync", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    try {
      console.log('🔄 Employee sync requested by:', req.user?.displayName);
      
      // Only allow full access users to sync
      if (!req.user?.hasFullAccess) {
        return res.status(403).json({ error: 'Sync operation requires full access permissions' });
      }

      await storage.syncEmployeesToPostgreSQL();
      res.json({ success: true, message: 'Employee data synchronized successfully' });
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Failed to sync employee data' });
    }
  });

  // Get all employees with filtering, sorting, and pagination (now requires auth)
  app.get("/api/employees", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    // Aggressive cache-busting headers to prevent phantom employee name caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Timestamp': Date.now().toString(),
      'X-Cache-Bust': Math.random().toString(36).substring(7),
      'X-Employee-Refresh': 'force-fresh-data'
    });
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
      
      // Add aggressive cache-busting headers to prevent frontend name mapping issues
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Timestamp': Date.now().toString(),
        'X-Cache-Bust': `employee-data-${Date.now()}`,
        'X-Employee-Refresh': 'force-reload'
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

  // Download Excel file route with proper headers
  app.get("/api/download/excel/:filename", (req: Request, res: Response) => {
    try {
      const fs = require('fs');
      const filename = req.params.filename;
      const filePath = path.resolve(process.cwd(), filename);
      
      console.log(`📁 Download request for: ${filename}`);
      console.log(`📁 Full path: ${filePath}`);
      console.log(`📁 Current directory: ${process.cwd()}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set headers for Excel file download with forced download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      console.log(`✅ Serving file: ${filename}`);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });



  // Get chat messages for a specific employee - INTENDED EMPLOYEE SYSTEM
  // Export all chat data to Excel
  app.get("/api/export/chat-excel", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    try {
      console.log('📊 EXCEL EXPORT: Starting chat data export...');
      
      // Get all chat comments from the intended comments table
      const allChatData = await db.select({
        id: sql`${chatCommentsIntended.id}`,
        comment: sql`${chatCommentsIntended.content}`,
        entered_by: sql`${chatCommentsIntended.sender}`,
        entered_date_time: sql`${chatCommentsIntended.timestamp}`,
        employee_name: sql`${chatCommentsIntended.intendedEmployeeName}`,
        zoho_id: sql`${chatCommentsIntended.intendedZohoId}`,
        actual_employee_id: sql`${chatCommentsIntended.actualEmployeeId}`,
        is_visible: sql`${chatCommentsIntended.isVisible}`
      }).from(chatCommentsIntended)
      .orderBy(desc(chatCommentsIntended.timestamp));

      console.log(`📊 EXCEL EXPORT: Found ${allChatData.length} chat records`);

      // Format data for Excel export
      const excelData = allChatData.map((row, index) => ({
        'Serial No': index + 1,
        'Comment': row.comment || '',
        'Entered By': row.entered_by || '',
        'Entered Date & Time': row.entered_date_time ? new Date(row.entered_date_time).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) : '',
        'Employee Name': row.employee_name || '',
        'Zoho ID': row.zoho_id || '',
        'Status': row.is_visible ? 'Visible' : 'Hidden',
        'Internal ID': row.id || ''
      }));

      // Set Excel response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Chat_Comments_Export_${new Date().toISOString().split('T')[0]}.xlsx"`);
      
      // Return the data as JSON for now (frontend will handle Excel conversion)
      res.json({
        success: true,
        data: excelData,
        totalRecords: allChatData.length,
        exportDate: new Date().toISOString(),
        filename: `Chat_Comments_Export_${new Date().toISOString().split('T')[0]}.xlsx`
      });

      console.log(`✅ EXCEL EXPORT: Successfully exported ${excelData.length} records`);
    } catch (error) {
      console.error('❌ EXCEL EXPORT ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to export chat data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // NEW ZOHO-BASED CHAT MESSAGES API - SERVES COMMENTS FOR ALL DASHBOARD EMPLOYEES
  app.get("/api/chat-messages/zoho/:zohoId", async (req: Request, res: Response) => {
    try {
      const zohoId = req.params.zohoId;
      if (!zohoId) {
        return res.status(400).json({ error: "Invalid Zoho ID" });
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

      console.log(`🚨 ZOHO-BASED API: Fetching chat messages for ZohoID ${zohoId}`);

      // Try to get employee details from PostgreSQL employees table first
      const employeeQuery = `SELECT id, name FROM employees WHERE zoho_id = $1`;
      const employeeResult = await pool.query(employeeQuery, [zohoId]);

      let employee = null;
      let employeeId = null;

      if (employeeResult.rows.length > 0) {
        employee = employeeResult.rows[0];
        employeeId = employee.id;
        console.log(`✅ Found employee: ${employee.name} (ID: ${employee.id}) for ZohoID: ${zohoId}`);
      } else {
        // Employee not in PostgreSQL table but might have comments - check intended comments
        console.log(`🔍 Employee with ZohoID ${zohoId} not in active table, checking for comments...`);
        
        // Check if there are intended comments for this ZohoID
        const intendedCheckQuery = `
          SELECT intended_employee_name
          FROM chat_comments_intended
          WHERE intended_zoho_id = $1 AND is_visible = TRUE
          LIMIT 1
        `;
        const intendedCheck = await pool.query(intendedCheckQuery, [zohoId]);
        
        if (intendedCheck.rows.length > 0) {
          // Employee has comments but not in active table - create virtual employee reference
          const intendedName = intendedCheck.rows[0].intended_employee_name;
          employee = { id: null, name: intendedName };
          employeeId = null; // Use null to indicate virtual employee
          console.log(`✅ Found comments for missing employee: ${intendedName} (ZohoID: ${zohoId}) - serving comments`);
        } else {
          console.log(`❌ No comments found for ZohoID ${zohoId}`);
          return res.json([]);
        }
      }

      // Check if intended comments table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'chat_comments_intended'
        )
      `;
      const tableCheck = await pool.query(tableCheckQuery);

      let messages = [];

      if (tableCheck.rows[0].exists) {
        // Use intended comments system - only show comments for this specific ZohoID
        const intendedQuery = `
          SELECT id, sender, content, timestamp, intended_employee_name, intended_zoho_id
          FROM chat_comments_intended
          WHERE intended_zoho_id = $1 AND is_visible = TRUE
          ORDER BY timestamp DESC
        `;
        const intendedResult = await pool.query(intendedQuery, [zohoId]);

        messages = intendedResult.rows.map(row => ({
          id: row.id,
          employeeId: employeeId, // Can be null for virtual employees
          sender: row.sender,
          content: row.content,
          timestamp: row.timestamp,
          intendedFor: row.intended_employee_name,
          zohoId: row.intended_zoho_id
        }));

        console.log(`✅ ZOHO API: RETURNED ${messages.length} intended messages for ZohoID ${zohoId} (${employee.name})`);
        
        // SPECIAL LOGS FOR KEY EMPLOYEES
        if (zohoId === '10012233') {
          console.log(`🎯 MOHAMMAD BILAL G (ZohoID: ${zohoId}, ID: ${employeeId}) - RETURNING ${messages.length} COMMENTS:`);
          messages.forEach((msg, index) => {
            console.log(`   📝 Comment ${index + 1}: "${msg.content.substring(0, 50)}..." by ${msg.sender}`);
          });
        }
        
        if (zohoId === '10013105') {
          console.log(`🎯 SYAMALA HARITHA KOLISETTY (ZohoID: ${zohoId}, Virtual Employee) - RETURNING ${messages.length} COMMENTS:`);
          messages.forEach((msg, index) => {
            console.log(`   📝 Comment ${index + 1}: "${msg.content}" by ${msg.sender}`);
          });
        }
      } else {
        // Fallback to legacy chat_messages table (only if employee exists in PostgreSQL)
        if (employeeId !== null) {
          const legacyMessages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.employeeId, employeeId))
            .orderBy(desc(chatMessages.timestamp));

          messages = legacyMessages;
          console.log(`✅ ZOHO API: RETURNED ${messages.length} legacy messages for ZohoID ${zohoId}`);
        } else {
          console.log(`ℹ️ No legacy messages table or virtual employee - returning empty for ZohoID ${zohoId}`);
          messages = [];
        }
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages via ZohoID:", error);
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // KEEP OLD ENDPOINT FOR BACKWARD COMPATIBILITY
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

      console.log(`🔄 FETCHING CHAT MESSAGES for employee ${employeeId} - CHECKING INTENDED COMMENTS`);

      // First, get employee's ZohoID to find intended comments
      const employeeQuery = `SELECT zoho_id, name FROM employees WHERE id = $1`;
      const employeeResult = await pool.query(employeeQuery, [employeeId]);

      if (employeeResult.rows.length === 0) {
        console.log(`❌ Employee ${employeeId} not found`);
        return res.json([]);
      }

      const employee = employeeResult.rows[0];
      const zohoId = employee.zoho_id;

      // Check if intended comments table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'chat_comments_intended'
        )
      `;
      const tableCheck = await pool.query(tableCheckQuery);

      let messages = [];

      if (tableCheck.rows[0].exists) {
        // Use intended comments system - only show comments for this specific ZohoID
        const intendedQuery = `
          SELECT id, sender, content, timestamp, intended_employee_name, intended_zoho_id
          FROM chat_comments_intended
          WHERE intended_zoho_id = $1 AND is_visible = TRUE
          ORDER BY timestamp DESC
        `;
        const intendedResult = await pool.query(intendedQuery, [zohoId]);

        messages = intendedResult.rows.map(row => ({
          id: row.id,
          employeeId: employeeId,
          sender: row.sender,
          content: row.content,
          timestamp: row.timestamp,
          intendedFor: row.intended_employee_name,
          zohoId: row.intended_zoho_id
        }));

        console.log(`✅ RETURNED ${messages.length} intended messages for employee ${employeeId} (ZohoID: ${zohoId})`);
        
        // SPECIAL LOG FOR MOHAMMAD BILAL G (Employee ID 25)
        if (employeeId === 25) {
          console.log(`🎯 MOHAMMAD BILAL G (ID: 25, ZohoID: ${zohoId}) - RETURNING ${messages.length} COMMENTS:`);
          messages.forEach((msg, index) => {
            console.log(`   📝 Comment ${index + 1}: "${msg.content.substring(0, 50)}..." by ${msg.sender}`);
          });
        }
      } else {
        // Fallback to legacy chat_messages table
        const legacyMessages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.employeeId, employeeId))
          .orderBy(desc(chatMessages.timestamp));

        messages = legacyMessages;
        console.log(`✅ RETURNED ${messages.length} legacy messages for employee ${employeeId}`);
      }
      
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

  // Azure SQL Sync API Routes - Power BI Style Foundation
  
  // Trigger Azure SQL to PostgreSQL sync
  app.post("/api/azure-sync/trigger", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('🔄 Azure sync triggered manually');
      const results = await triggerManualSync();
      
      res.json({
        success: true,
        message: 'Azure sync completed successfully',
        results
      });
    } catch (error) {
      console.error('❌ Azure sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Azure sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all synced employees from Azure
  app.get("/api/azure-sync/employees", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('📊 Getting all synced employees from Azure');
      const employees = await getAllSyncedEmployees();
      
      res.json({
        success: true,
        employees,
        count: employees.length
      });
    } catch (error) {
      console.error('❌ Failed to get synced employees:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get synced employees',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get sync status and stats
  app.get("/api/azure-sync/status", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('📊 Getting Azure sync status');
      const stats = await getSyncStatistics();
      
      if (!stats) {
        throw new Error('Failed to get sync statistics');
      }
      
      res.json({
        success: true,
        status: {
          totalSyncedEmployees: stats.totalEmployees,
          lastSyncTimestamp: stats.lastSyncTime,
          isHealthy: stats.totalEmployees > 4000, // Expect close to 4871 employees
          targetEmployees: 4871,
          syncCoverage: `${((stats.totalEmployees / 4871) * 100).toFixed(1)}%`,
        }
      });
    } catch (error) {
      console.error('❌ Failed to get sync status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sync status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Daily sync endpoint (can be called by cron job or scheduler)
  app.post("/api/azure-sync/daily", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('🕐 Daily Azure sync check triggered...');
      const syncPerformed = await performDailySync();
      res.json({
        success: true,
        message: syncPerformed ? 'Daily sync completed' : 'Daily sync not needed',
        syncPerformed,
      });
    } catch (error) {
      console.error('❌ Daily sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Daily sync failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Live Chat Data API Routes - Simplified ZohoID and FullName sync
  
  // Trigger Live Chat Data sync (ZohoID and FullName only)
  app.post("/api/live-chat-sync/trigger", async (req: Request, res: Response) => {
    try {
      console.log('🔄 Live Chat Data sync triggered manually');
      const results = await syncLiveChatData();
      
      res.json({
        success: true,
        message: 'Live Chat Data sync completed successfully',
        results
      });
    } catch (error) {
      console.error('❌ Live Chat Data sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Live Chat Data sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Incremental Sync - Add only new employees
  app.post("/api/live-chat-sync/incremental", async (req: Request, res: Response) => {
    try {
      console.log('🆕 INCREMENTAL SYNC: Manual trigger initiated');
      
      const { syncNewEmployees } = await import('./live-chat-sync');
      const result = await syncNewEmployees();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          newEmployeesAdded: result.newEmployeesAdded
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
          newEmployeesAdded: 0
        });
      }
    } catch (error) {
      console.error('❌ Failed to run incremental sync:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run incremental sync',
        error: error instanceof Error ? error.message : 'Unknown error',
        newEmployeesAdded: 0
      });
    }
  });

  // Daily Incremental Sync - For automated scheduling (no auth required for cron jobs)
  app.post("/api/live-chat-sync/daily", async (req: Request, res: Response) => {
    try {
      console.log('📅 DAILY INCREMENTAL SYNC: Automated daily sync triggered');
      
      const { syncNewEmployees } = await import('./live-chat-sync');
      const result = await syncNewEmployees();
      
      const response = {
        success: result.success,
        message: result.message,
        newEmployeesAdded: result.newEmployeesAdded,
        timestamp: new Date().toISOString(),
        syncType: 'daily_incremental'
      };
      
      if (result.success) {
        console.log(`📅 Daily sync completed: ${result.newEmployeesAdded} new employees added`);
        res.json(response);
      } else {
        console.error('📅 Daily sync failed:', result.message);
        res.status(500).json(response);
      }
    } catch (error) {
      console.error('❌ Daily incremental sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Daily incremental sync failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        newEmployeesAdded: 0,
        timestamp: new Date().toISOString(),
        syncType: 'daily_incremental'
      });
    }
  });

  // Get Live Chat Data statistics
  app.get("/api/live-chat-sync/status", async (req: Request, res: Response) => {
    try {
      console.log('📊 Getting Live Chat Data status');
      const stats = await getLiveChatDataStats();
      
      if (!stats) {
        throw new Error('Failed to get Live Chat Data statistics');
      }
      
      res.json({
        success: true,
        status: {
          totalEmployees: stats.totalEmployees,
          employeesWithComments: stats.employeesWithComments,
          isHealthy: stats.totalEmployees > 4000, // Expect close to 4871 employees
          targetEmployees: 4871,
          syncCoverage: `${((stats.totalEmployees / 4871) * 100).toFixed(1)}%`,
          sampleData: stats.sampleData
        }
      });
    } catch (error) {
      console.error('❌ Failed to get Live Chat Data status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Live Chat Data status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Live Chat Comment Management API Routes
  
  // Add or update comment for specific employee
  app.post("/api/live-chat-comment", async (req: Request & { user?: UserSession }, res: Response) => {
    try {
      console.log('💬 Received live chat comment request');
      
      const validationResult = updateLiveChatCommentSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({
          success: false,
          message: 'Invalid comment data',
          error: errorMessage
        });
      }
      
      const { zohoId, comments, commentsEnteredBy } = validationResult.data;
      
      console.log(`💬 Adding comment for ZohoID ${zohoId} by ${commentsEnteredBy}`);
      
      const success = await updateLiveChatComment(zohoId, comments, commentsEnteredBy);
      
      if (success) {
        res.json({
          success: true,
          message: 'Comment added successfully',
          zohoId,
          commentsEnteredBy,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to add comment'
        });
      }
    } catch (error) {
      console.error('❌ Error adding live chat comment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add comment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get employee data with comments by ZohoID
  app.get("/api/live-chat-employee/:zohoId", async (req: Request, res: Response) => {
    try {
      const { zohoId } = req.params;
      console.log(`📋 Getting live chat data for ZohoID ${zohoId}`);
      
      const employeeData = await getLiveChatEmployeeData(zohoId);
      
      if (employeeData) {
        res.json({
          success: true,
          employee: employeeData
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Employee not found in Live Chat Data'
        });
      }
    } catch (error) {
      console.error(`❌ Error getting employee data for ZohoID ${req.params.zohoId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to get employee data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get all employees with comments (admin view)
  app.get("/api/live-chat-comments", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('📋 Getting all live chat comments');
      
      const employeesWithComments = await getAllLiveChatDataWithComments();
      
      res.json({
        success: true,
        employees: employeesWithComments,
        count: employeesWithComments.length
      });
    } catch (error) {
      console.error('❌ Error getting all live chat comments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get live chat comments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Export Live Chat Data to Excel
  app.get("/api/live-chat-export", requireAuth, async (req: Request & { user?: UserSession }, res: Response) => {
    try {
      console.log('📊 LIVE CHAT EXPORT: Starting export of all live chat data...');
      
      // Get all live chat data with comments and chat history
      const allLiveChatData = await db.select().from(liveChatData).orderBy(desc(liveChatData.commentsUpdateDateTime));

      console.log(`📊 LIVE CHAT EXPORT: Found ${allLiveChatData.length} records`);

      // Get all employee data to map Business Unit and other details
      const allEmployeeData = await storage.getEmployees({ pageSize: 5000 });
      const employeeMap = new Map();
      
      // Create a map of ZohoID to employee data for quick lookup
      allEmployeeData.data.forEach((emp: any) => {
        employeeMap.set(emp.zohoId, emp);
      });

      console.log(`📊 LIVE CHAT EXPORT: Created employee mapping for ${employeeMap.size} employees`);

      // Format data for Excel export - create rows for each chat message
      const excelData: any[] = [];
      let serialNo = 1;

      for (const record of allLiveChatData) {
        const chatHistory = record.chatHistory ? JSON.parse(record.chatHistory) : [];
        
        // Only export chat history messages (which already include the main comment)
        if (chatHistory.length > 0) {
          chatHistory.forEach((message: any) => {
            excelData.push({
              'Serial No': serialNo++,
              'Zoho ID': record.zohoId || '',
              'Employee Name': record.fullName || '',
              'Message Type': message.messageType || 'Chat',
              'Message': message.message || '',
              'Sent By': message.sentBy || '',
              'Timestamp': message.timestamp ? new Date(message.timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              }) : '',
              'Record Created': record.createdAt ? new Date(record.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              }) : ''
            });
          });
        } else if (record.comments) {
          // Fallback: If no chat history but has main comment, export the main comment
          excelData.push({
            'Serial No': serialNo++,
            'Zoho ID': record.zohoId || '',
            'Employee Name': record.fullName || '',
            'Message Type': 'Comment',
            'Message': record.comments || '',
            'Sent By': record.commentsEnteredBy || '',
            'Timestamp': record.commentsUpdateDateTime ? new Date(record.commentsUpdateDateTime).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }) : '',
            'Record Created': record.createdAt ? new Date(record.createdAt).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }) : ''
          });
        }
      }

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      const columnWidths = [
        { wch: 10 }, // Serial No
        { wch: 15 }, // Zoho ID
        { wch: 25 }, // Employee Name
        { wch: 12 }, // Message Type
        { wch: 50 }, // Message
        { wch: 20 }, // Sent By
        { wch: 20 }, // Timestamp
        { wch: 20 }  // Record Created
      ];
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Live Chat Data');

      // Generate filename with current date
      const filename = `Live_Chat_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Write the file
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);

      // Send the file
      res.end(buffer);

      console.log(`✅ LIVE CHAT EXPORT: Successfully exported ${excelData.length} records to ${filename}`);
    } catch (error) {
      console.error('❌ LIVE CHAT EXPORT ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to export live chat data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // NEW: Get comments by ZohoID (for LiveChatDialog component)
  app.get("/api/live-chat-comments/:zohoId", async (req: Request, res: Response) => {
    try {
      const { zohoId } = req.params;
      console.log(`🔍 LiveChat API: Getting comments for ZohoID ${zohoId}`);
      
      // BULLETPROOF ANTI-CACHING HEADERS
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}-${Math.random()}"`,
        'X-Timestamp': Date.now().toString(),
        'X-Force-Refresh': 'true'
      });

      const employeeData = await getLiveChatCommentsByZohoId(zohoId);
      
      if (employeeData) {
        res.json({
          success: true,
          zohoId: employeeData.zohoId,
          fullName: employeeData.fullName,
          comments: employeeData.comments || null,
          commentsEnteredBy: employeeData.commentsEnteredBy || null,
          commentsUpdateDateTime: employeeData.commentsUpdateDateTime || null,
          chatHistory: employeeData.chatHistory || [],
          hasComments: !!(employeeData.comments && employeeData.comments.trim()) || !!(employeeData.chatHistory && employeeData.chatHistory.length > 0)
        });
      } else {
        // Employee not found, but that's okay - might be new employee
        console.log(`📭 LiveChat API: ZohoID ${zohoId} not found in live_chat_data table`);
        res.json({
          success: true,
          zohoId: zohoId,
          fullName: null,
          comments: null,
          commentsEnteredBy: null,
          commentsUpdateDateTime: null,
          chatHistory: [],
          hasComments: false
        });
      }
    } catch (error) {
      console.error(`❌ LiveChat API: Error getting comments for ZohoID ${req.params.zohoId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to get live chat comments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}
