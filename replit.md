# Employee Timesheet Dashboard

## Overview

This project is a full-stack web application for employee timesheet management. It displays employee data with filtering, sorting, and pagination capabilities. The application consists of a React frontend with Tailwind CSS and shadcn/ui components, and an Express backend that serves API endpoints for employee data. Drizzle ORM is used for database interactions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Access Control Updates (June 21, 2025)
- Updated Huzefa Peshawarwala (huzefa@royalcyber.com) from full access to Digital Commerce Business Unit only
- Changed Timesheet Admin (timesheet.admin@royalcyber.com) from Digital Transformation to Digital Commerce Business Unit
- Cleared cached sessions (52 sessions removed) to ensure immediate permission updates
- Both users now have identical Digital Commerce Business Unit access restrictions

## System Architecture

The application follows a modern web architecture with clear separation of concerns:

1. **Frontend**: React application built with Vite, using TypeScript for type safety
   - UI components from shadcn/ui (based on Radix UI primitives)
   - TanStack React Query for API data fetching
   - Tailwind CSS for styling
   - Wouter for lightweight routing

2. **Backend**: Express.js server
   - REST API endpoints for employee data
   - Request logging middleware
   - API filtering capabilities

3. **Database**: PostgreSQL with Drizzle ORM
   - Schema definitions for employee timesheet data
   - Type-safe database queries

4. **Shared Code**: Common types and schemas shared between frontend and backend
   - Zod for validation

## Key Components

### Frontend Components

1. **App.tsx**: Main application component with router setup
   - Sets up QueryClientProvider for data fetching
   - Configures routing with wouter

2. **Dashboard.tsx**: Main page that displays employee data
   - Fetches employee data using React Query
   - Implements filtering, sorting, and pagination

3. **FilterSection.tsx**: Component for filtering employee data
   - Dropdowns for filtering by department, status, business unit, etc.
   - Reset filter functionality

4. **EmployeeTable.tsx**: Table component that displays employee data
   - Built on top of DataTable component
   - Supports sorting, filtering, and pagination

5. **UI Components**: Extensive set of UI components from shadcn/ui
   - Button, Card, Select, Input, Table, etc.
   - Toast notifications
   - Modal dialogs

### Backend Components

1. **server/index.ts**: Express server setup
   - Middleware configuration
   - Routes registration
   - Error handling

2. **server/routes.ts**: API route definitions
   - Employee data endpoints with filtering and pagination
   - Parameter validation

3. **server/storage.ts**: Data access layer
   - Memory storage implementation (likely for development)
   - CRUD operations for employee data

4. **shared/schema.ts**: Database schema definitions
   - Employee table schema
   - Zod validation schemas for API requests

## Data Flow

1. **API Request Flow**:
   - Client makes request to `/api/employees` with filter parameters
   - Express middleware logs request details
   - Route handler validates parameters using Zod
   - Storage layer fetches filtered data
   - Response is sent back to client as JSON

2. **Frontend Data Flow**:
   - Dashboard component fetches data using React Query
   - User interacts with FilterSection to set filters
   - FilterSection updates filter state in Dashboard
   - Dashboard refetches data with new filters
   - EmployeeTable renders updated data

## External Dependencies

### Frontend
- React ecosystem: react, react-dom, react-hook-form
- TanStack React Query: For data fetching and cache management
- shadcn/ui components: Built on Radix UI primitives
- Tailwind CSS: For styling
- Wouter: For routing
- Vite: For development and build

### Backend
- Express: Web server framework
- Drizzle ORM: For database interactions
- Zod: For validation
- connect-pg-simple: For PostgreSQL session store

## Deployment Strategy

The application is configured for deployment on Replit:

1. **Development Mode**:
   - `npm run dev`: Starts both server and client in development mode
   - Vite handles hot module replacement for frontend
   - Server restarts automatically when code changes

2. **Production Build**:
   - `npm run build`: Builds frontend with Vite and backend with esbuild
   - Frontend assets are placed in `dist/public`
   - Backend code is bundled to `dist/index.js`

3. **Production Start**:
   - `npm run start`: Runs the production build
   - Serves static frontend assets from `dist/public`
   - API requests are handled by the Express server

The Replit configuration specifies:
- Node.js 20 as the runtime
- PostgreSQL 16 for the database
- Port 5000 for local development, mapped to port 80 for external access

## Database Schema

The primary database table is `employees` with the following fields:
- `id`: Primary key
- `name`: Employee name
- `zohoId`: Unique identifier from Zoho
- `department`: Department name
- `status`: Employee status (Active, Inactive, Pending)
- `businessUnit`: Business unit name
- `client`: Client name
- `project`: Project name
- `lastMonthBillable`: Dollar amount billed last month
- `lastMonthBillableHours`: Billable hours last month
- `lastMonthNonBillableHours`: Non-billable hours last month
- `cost`: Dollar amount cost
- `comments`: Optional comments
- `timesheetAging`: Aging category (0-30, 31-60, 61-90, 90+)

## Development Workflow

1. Make changes to frontend code in the `client/src` directory
2. Update backend code in the `server` directory
3. Modify database schema in `shared/schema.ts`
4. Run `npm run db:push` to update the database schema
5. Use `npm run dev` to test changes locally
6. Build and deploy with `npm run build` followed by `npm run start`