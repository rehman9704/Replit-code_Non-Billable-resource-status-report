# Employee Timesheet Dashboard - Project Structure & Setup Guide

## Project Overview
This is a full-stack React application with Express backend, featuring Azure AD authentication and employee management capabilities.

## Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Shadcn/ui + Tailwind CSS
- **Authentication**: Azure AD + SharePoint integration

## Project Structure
```
project-root/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn/ui components
│   │   │   ├── FilterSection.tsx
│   │   │   ├── EmployeeTable.tsx
│   │   │   └── DataTable.tsx
│   │   ├── pages/
│   │   │   └── Dashboard.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── lib/
│   │   │   └── utils/
│   │   └── index.css
│   └── index.html
├── server/
│   ├── auth.ts              # Azure AD authentication
│   ├── routes.ts            # API endpoints
│   ├── storage.ts           # Database layer
│   ├── db.ts                # Database connection
│   └── index.ts             # Server entry point
├── shared/
│   └── schema.ts            # Shared TypeScript types
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
└── tsconfig.json
```

## Setup Instructions

### 1. Initialize New Project
```bash
npm create vite@latest my-employee-dashboard --template react-ts
cd my-employee-dashboard
```

### 2. Install Dependencies
```bash
# Core dependencies
npm install express axios drizzle-orm drizzle-kit @tanstack/react-query
npm install @radix-ui/react-select @radix-ui/react-dialog wouter
npm install tailwindcss @tailwindcss/typography autoprefixer
npm install @azure/msal-node zod drizzle-zod class-variance-authority

# Development dependencies
npm install -D @types/express @types/node tsx typescript
npm install -D @vitejs/plugin-react vite tailwindcss-animate
```

### 3. Environment Variables Required
Create `.env` file:
```
DATABASE_URL=postgresql://username:password@host:port/database
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id
```

### 4. Key Configuration Files

#### package.json scripts:
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "tsc && vite build",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate"
  }
}
```

#### vite.config.ts:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './client/assets'),
    },
  },
})
```

## Key Features to Replicate

### 1. Authentication System
- Azure AD integration with SharePoint permissions
- Role-based access control (Full access, Department-based, Client-based, Business Unit-based)
- Session management with database storage

### 2. Data Management
- PostgreSQL database with Drizzle ORM
- Real-time employee data filtering and search
- Excel export functionality
- WebSocket chat system for employee records

### 3. UI Components
- Responsive dashboard with PowerBI-style filters
- Multi-select dropdowns with search
- Data table with sorting, pagination, and search
- Professional color scheme and typography

### 4. API Structure
- RESTful endpoints with proper validation
- Filter-based employee data retrieval
- Authentication middleware
- Error handling and logging

## Styling Specifications

### Colors (HSL format):
- Background: `0 0% 100%` (White)
- Text: `20 14.3% 4.1%` (Dark Gray)
- Primary: `207 90% 54%` (Blue)
- Muted: `60 4.8% 95.9%` (Light Gray)
- Border: `20 5.9% 90%` (Light Border)

### Typography:
- Headers: `text-2xl font-bold` (24px)
- Subheaders: `text-lg font-semibold` (18px)
- Body: `text-sm font-medium` (14px)
- Table headers: `text-xs font-semibold` (12px)

## Database Schema
Key tables:
- `employees` - Main employee data
- `userSessions` - Authentication sessions
- `chatMessages` - Employee chat records

## Deployment Considerations
- Works with Replit's deployment system
- Requires Azure AD app registration
- Database connection via environment variables
- Static file serving for production builds

## Customization Points
1. **Authentication**: Modify `server/auth.ts` for different auth providers
2. **Data Sources**: Update `server/storage.ts` for different databases
3. **UI Theme**: Modify `client/src/index.css` for custom colors
4. **Filters**: Customize `FilterSection.tsx` for different data fields
5. **Permissions**: Update access control logic in `getUserPermissions()`

This structure provides a complete enterprise-grade application template that can be adapted for various business requirements.