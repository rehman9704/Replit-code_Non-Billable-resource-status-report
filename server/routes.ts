import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { employeeFilterSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

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

  return httpServer;
}
