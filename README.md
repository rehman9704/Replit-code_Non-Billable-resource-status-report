# Non Billable Resource Status Report

A real-time enterprise dashboard providing comprehensive non-billable resource information to Finance Management, built with Microsoft Azure integration and deployed on Replit.

## Overview

This application delivers dynamic, granular access management for multi-client organizational environments with advanced employee performance tracking and robust business unit-level permission management.

## Key Features

- **Real-time Data Processing**: Live employee status updates with Azure SQL Database integration
- **Advanced Authentication**: Microsoft Azure AD and SharePoint integration with role-based access control
- **Dynamic Filtering**: PowerBI-style filtering with multi-select capabilities
- **Excel Export**: Comprehensive data export functionality
- **Real-time Chat**: Employee-specific chat system with WebSocket integration
- **Responsive Design**: Professional UI with enterprise-grade styling

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: Azure SQL Database with Drizzle ORM
- **Authentication**: Azure AD + SharePoint
- **UI Framework**: Shadcn/ui + Tailwind CSS
- **Data Fetching**: TanStack React Query
- **Real-time**: WebSocket implementation

## Access Control System

### User Roles
- **Full Access Users**: Complete system access across all departments and clients
- **Department-based Access**: Restricted to specific departments
- **Client-based Access**: Limited to assigned client portfolios
- **Business Unit Access**: Focused on specific business units

### Permission Matrix
The system dynamically assigns permissions based on:
- SharePoint list configurations
- Department head assignments
- Practice head responsibilities
- Business unit management roles

## Project Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── contexts/      # React contexts for state management
│   │   └── lib/           # Utility functions and helpers
├── server/                # Express backend
│   ├── auth.ts           # Azure AD authentication logic
│   ├── routes.ts         # API endpoint definitions
│   ├── storage.ts        # Database interaction layer
│   └── index.ts          # Server entry point
├── shared/               # Shared TypeScript definitions
└── documentation/        # Project documentation and guides
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Azure AD application registration
- Azure SQL Database access
- SharePoint permissions for user management

### Installation

1. Clone the repository:
```bash
git clone https://github.com/[username]/Non-Billable-resource-status-report_Replitt.git
cd Non-Billable-resource-status-report_Replitt
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Azure and database configurations
```

4. Initialize the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Environment Variables

Required environment variables for deployment:

```env
DATABASE_URL=your_azure_sql_connection_string
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id
```

## Deployment

This application is optimized for Replit deployment with automatic scaling and built-in security features.

### Production Deployment
1. Configure production environment variables
2. Update Azure AD redirect URIs for production domain
3. Deploy to Replit or your preferred hosting platform

## Data Sources

- **Employee Data**: Real-time synchronization with Azure SQL Database
- **Authentication**: Microsoft Azure Active Directory
- **Permissions**: SharePoint lists for department and client assignments
- **Chat History**: PostgreSQL storage for employee communication logs

## Security Features

- Azure AD single sign-on integration
- Role-based access control with granular permissions
- Secure session management with database storage
- Environment variable protection for sensitive data
- HTTPS enforcement in production

## Performance Optimizations

- Database connection pooling for Azure SQL
- React Query for efficient data caching
- Optimized database queries with proper indexing
- WebSocket connections for real-time updates
- Lazy loading for improved initial load times

## Contributing

This is a proprietary enterprise application for Royal Cyber finance management. For internal development guidelines and contribution processes, please contact the development team.

## Support

For technical support or feature requests, please contact:
- Development Team: [Internal Contact]
- Finance Management: [Internal Contact]

## License

Proprietary - Royal Cyber Internal Use Only

---

**Built with ❤️ for Royal Cyber Finance Management**
*Deployed on Replit • Powered by Microsoft Azure*