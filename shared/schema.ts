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
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// Define filter schema for API requests
export const employeeFilterSchema = z.object({
  department: z.string().optional(),
  billableStatus: z.string().optional(),
  businessUnit: z.string().optional(),
  client: z.string().optional(),
  project: z.string().optional(),
  timesheetAging: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
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
