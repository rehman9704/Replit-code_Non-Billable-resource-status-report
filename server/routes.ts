import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { employeeFilterSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer, WebSocket } from 'ws';

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

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Get all employees with filtering, sorting, and pagination
  app.get("/api/employees", async (req: Request, res: Response) => {
    try {
      const filterParams = {
        department: req.query.department as string | undefined,
        status: req.query.status as string | undefined,
        businessUnit: req.query.businessUnit as string | undefined,
        client: req.query.client as string | undefined,
        project: req.query.project as string | undefined,
        timesheetAging: req.query.timesheetAging as string | undefined,
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

  // Get filter options for dropdown menus
  app.get("/api/filter-options", async (_req: Request, res: Response) => {
    try {
      const filterOptions = await storage.getFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
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
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ChatMessage;
        
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
        
        console.log(`Received message from ${message.sender} for employee ${message.employeeId}`);
        
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
