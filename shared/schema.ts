import { pgTable, text, serial, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Original users schema - keeping for reference
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Employee timesheet data schema
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  zohoId: text("zoho_id").notNull().unique(),
  department: text("department").notNull(),
  location: text("location").notNull(),
  billableStatus: text("billable_status").notNull(), // 'No timesheet filled', 'Non-Billable'
  businessUnit: text("business_unit").notNull(),
  client: text("client").notNull(),
  project: text("project").notNull(),
  lastMonthBillable: numeric("last_month_billable").notNull(), // Dollar amount
  lastMonthBillableHours: numeric("last_month_billable_hours").notNull(),
  lastMonthNonBillableHours: numeric("last_month_non_billable_hours").notNull(),
  cost: numeric("cost").notNull(), // Dollar amount
  comments: text("comments"),
  timesheetAging: text("timesheet_aging").notNull(), // '0-30', '31-60', '61-90', '90+'
  nonBillableAging: text("non_billable_aging"), // 'Non-Billable ≤10 days', 'Non-Billable >10 days', etc.
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// Define filter schema for API requests - simplified to always use arrays
export const employeeFilterSchema = z.object({
  department: z.array(z.string()).optional(),
  billableStatus: z.array(z.string()).optional(),
  businessUnit: z.array(z.string()).optional(),
  client: z.array(z.string()).optional(),
  project: z.array(z.string()).optional(),
  timesheetAging: z.array(z.string()).optional(),
  location: z.array(z.string()).optional(),
  nonBillableAging: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  allowedClients: z.array(z.string()).optional(),
  allowedDepartments: z.array(z.string()).optional(),
  allowedBusinessUnits: z.array(z.string()).optional(),
});

export type EmployeeFilter = z.infer<typeof employeeFilterSchema>;

// Filter options schema
export const filterOptionsSchema = z.object({
  departments: z.array(z.string()),
  billableStatuses: z.array(z.string()),
  businessUnits: z.array(z.string()),
  clients: z.array(z.string()),
  projects: z.array(z.string()),
  timesheetAgings: z.array(z.string()),
  locations: z.array(z.string()),
  nonBillableAgings: z.array(z.string()),
});

export type FilterOptions = z.infer<typeof filterOptionsSchema>;

// Chat messages schema for persistent chat history
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  sender: text("sender").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// User sessions schema for authentication
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userEmail: text("user_email").notNull(),
  displayName: text("display_name").notNull(),
  hasFullAccess: boolean("has_full_access").notNull().default(false),
  allowedDepartments: text("allowed_departments").array().notNull().default([]),
  allowedClients: text("allowed_clients").array().notNull().default([]),
  allowedBusinessUnits: text("allowed_business_units").array().notNull().default([]),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessed: timestamp("last_accessed").defaultNow().notNull(),
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
  lastAccessed: true,
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// Chat comments intended table - for ZohoID-based employee attribution
export const chatCommentsIntended = pgTable("chat_comments_intended", {
  id: serial("id").primaryKey(),
  intendedZohoId: text("intended_zoho_id").notNull(),
  intendedEmployeeName: text("intended_employee_name").notNull(),
  sender: text("sender").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isVisible: boolean("is_visible").default(false),
  actualEmployeeId: integer("actual_employee_id").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatCommentIntendedSchema = createInsertSchema(chatCommentsIntended).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

export type InsertChatCommentIntended = z.infer<typeof insertChatCommentIntendedSchema>;
export type ChatCommentIntended = typeof chatCommentsIntended.$inferSelect;

// Azure SQL Employee Sync Table - Power BI Style Foundation
export const azureEmployeeSync = pgTable("azure_employee_sync", {
  id: serial("id").primaryKey(),
  zohoId: text("zoho_id").notNull().unique(),
  employeeName: text("employee_name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncTimestamp: timestamp("last_sync_timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAzureEmployeeSyncSchema = createInsertSchema(azureEmployeeSync).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAzureEmployeeSync = z.infer<typeof insertAzureEmployeeSyncSchema>;
export type AzureEmployeeSync = typeof azureEmployeeSync.$inferSelect;
