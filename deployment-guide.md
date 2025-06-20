# Complete Deployment Guide for Employee Timesheet Dashboard

## Quick Start Methods

### Method 1: Download from Replit (Easiest)
1. Click the three-dot menu (⋯) in Replit
2. Select "Download as zip"
3. Extract the files to your local machine
4. Follow the setup instructions below

### Method 2: Fork and Clone
1. Fork this Replit project
2. Clone it to your local machine:
```bash
git clone <your-forked-repo-url>
cd employee-timesheet-dashboard
```

### Method 3: Manual Recreation
Use the files I've created (`project-structure.md` and `setup-package.json`) to recreate the project from scratch.

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
# or if using the setup-package.json file:
cp setup-package.json package.json
npm install
```

### 2. Environment Configuration
Create `.env` file in root directory:
```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Azure AD Configuration
AZURE_CLIENT_ID=your_client_id_here
AZURE_CLIENT_SECRET=your_client_secret_here
AZURE_TENANT_ID=your_tenant_id_here

# Optional: Development settings
NODE_ENV=development
PORT=5000
```

### 3. Database Setup
```bash
# Push schema to database
npm run db:push

# Or generate migrations
npm run db:generate
npm run db:migrate
```

### 4. Start Development Server
```bash
npm run dev
```

Application will be available at `http://localhost:5000`

## Azure AD Setup Requirements

### 1. Register Azure AD App
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Create new registration with these settings:
   - Name: "Employee Timesheet Dashboard"
   - Redirect URI: `http://localhost:5000/auth/callback` (for dev)
   - For production: `https://yourdomain.com/auth/callback`

### 2. Configure API Permissions
Add these permissions:
- Microsoft Graph: `User.Read`
- SharePoint: `Sites.Read.All` (for department/client permissions)

### 3. Generate Client Secret
1. Go to "Certificates & secrets"
2. Create new client secret
3. Copy the value to your `.env` file

## Database Options

### Option 1: PostgreSQL (Recommended)
```bash
# Local PostgreSQL
createdb employee_dashboard

# Or use cloud providers:
# - Supabase
# - Neon
# - Railway
# - Heroku Postgres
```

### Option 2: Azure SQL Database
Update `server/storage.ts` to use the Azure SQL implementation instead of PostgreSQL.

## Deployment Options

### Deploy to Replit (Easiest)
1. Upload your project to Replit
2. Configure environment variables in Replit Secrets
3. Run the project - Replit handles deployment automatically

### Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

### Deploy to Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Deploy to Heroku
```bash
# Install Heroku CLI
heroku create your-app-name
heroku config:set DATABASE_URL=your_database_url
heroku config:set AZURE_CLIENT_ID=your_client_id
# ... set other environment variables
git push heroku main
```

## Customization for Other Applications

### 1. Database Schema Changes
Modify `shared/schema.ts` for your data model:
```typescript
export const yourTable = pgTable("your_table", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  // Add your fields here
});
```

### 2. Authentication Customization
Update `server/auth.ts`:
- Change user permission logic
- Modify SharePoint integration
- Add different auth providers

### 3. UI Customization
Update styling in `client/src/index.css`:
```css
:root {
  --your-primary: 210 90% 54%;  /* Custom blue */
  --your-background: 0 0% 98%;  /* Custom background */
}
```

### 4. Filter and Table Customization
Modify `FilterSection.tsx` and `EmployeeTable.tsx`:
- Change filter options
- Update table columns
- Modify data display logic

## Production Considerations

### Security
- Use HTTPS in production
- Set secure cookie settings
- Configure CORS properly
- Use environment variables for all secrets

### Performance
- Enable database connection pooling
- Implement caching for SharePoint data
- Optimize database queries
- Use CDN for static assets

### Monitoring
- Add logging middleware
- Set up error tracking (Sentry, etc.)
- Monitor database performance
- Track authentication failures

## Troubleshooting Common Issues

### Authentication Issues
- Verify Azure AD redirect URIs match exactly
- Check client secret hasn't expired
- Ensure proper API permissions are granted

### Database Connection Issues
- Verify connection string format
- Check firewall settings
- Ensure database exists and is accessible

### Build Issues
- Clear node_modules and reinstall
- Check TypeScript compilation errors
- Verify all environment variables are set

## File Structure for Transfer
When downloading/transferring, ensure you have:
```
/client/          # Frontend React application
/server/          # Backend Express server
/shared/          # Shared TypeScript types
package.json      # Dependencies and scripts
vite.config.ts    # Vite configuration
tailwind.config.ts # Tailwind CSS configuration
drizzle.config.ts # Database configuration
tsconfig.json     # TypeScript configuration
.env.example      # Environment variable template
```

This application template provides a solid foundation for building enterprise-grade dashboards with authentication, real-time data, and professional UI components.