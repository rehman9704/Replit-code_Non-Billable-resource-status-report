import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';

// Initialize Azure authentication lazily to avoid startup errors
let pca: ConfidentialClientApplication | null = null;

function getAzureClient() {
  if (!pca) {
    const clientConfig = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID || "6fca091e-c091-454f-8283-360c59963fc4",
        clientSecret: process.env.AZURE_CLIENT_SECRET || "36t8Q~NmHD_H4dMSg3KxTo7NobtiOIlnL5Ef6a15",
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || "d508624f-a0b7-4fd3-9511-05b18ca02784"}`
      }
    };
    pca = new ConfidentialClientApplication(clientConfig);
  }
  return pca;
}

interface UserPermissions {
  hasFullAccess: boolean;
  allowedDepartments: string[];
  allowedClients: string[];
  userEmail: string;
}

interface SharePointListItem {
  Title: string;
  PracticeHead?: string;
  DeliveryHead?: string;
  BU?: string;
}

interface ClientListItem {
  Title: string;
  DeliveryHead?: string;
  PracticeHead?: string;
  BU?: string;
}

// Full access users
const FULL_ACCESS_USERS = [
  'mas@royalcyber.com',
  'kishore.kumar@royalcyber.com', 
  'huzefa@royalcyber.com',
  'aravind.dumpala@royalcyber.com',
  'farhan.ahmed@royalcyber.com',
  'rehman.shahid@royalcyber.com',
  'karthik.v@royalcyber.com'
];

// Client-based access users
const CLIENT_BASED_USERS = [
  'krishna.k@royalcyber.com',
  'natasha@royalcyber.com',
  'ashok.lakshman@royalcyber.com'
];

export async function getAuthUrl(req?: any): Promise<string> {
  const client = getAzureClient();
  
  // Detect domain from the actual request if available
  let baseUrl: string;
  if (req && req.get) {
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    baseUrl = `${protocol}://${host}`;
    console.log('🔍 Request-based detection:', baseUrl);
    
    // Special handling for custom domain
    if (host === 'nonbillableresourcereport.royalcyber.org') {
      console.log('🎯 Custom domain detected:', host);
    }
  } else {
    // Fallback to environment detection
    const reployName = process.env.REPL_ID || '';
    const isReplitApp = process.env.REPLIT_DEPLOYMENT === '1' || 
                        process.env.NODE_ENV === 'production' ||
                        reployName.includes('nonbillableresource');
    
    baseUrl = isReplitApp 
      ? 'https://nonbillableresource.replit.app'
      : `https://${process.env.REPLIT_DEV_DOMAIN}`;
    console.log('🔍 Environment-based detection:', baseUrl);
  }
  
  const redirectUri = `${baseUrl}/auth/callback`;
  console.log('- Auth redirect URI being used:', redirectUri);
    
  const authCodeUrlParameters = {
    scopes: ['user.read', 'Directory.Read.All'],
    redirectUri,
  };

  const response = await client.getAuthCodeUrl(authCodeUrlParameters);
  console.log('Generated auth URL (first 100 chars):', response.substring(0, 100));
  return response;
}

export async function handleCallback(code: string, req?: any): Promise<any> {
  const client = getAzureClient();
  
  // Use the same domain detection logic as getAuthUrl
  let baseUrl: string;
  if (req && req.get) {
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    baseUrl = `${protocol}://${host}`;
    console.log('🔍 Callback Request-based detection:', baseUrl);
    
    // Special handling for custom domain
    if (host === 'nonbillableresourcereport.royalcyber.org') {
      console.log('🎯 Custom domain detected in callback:', host);
    }
  } else {
    // Fallback to environment detection
    const reployName = process.env.REPL_ID || '';
    const isReplitApp = process.env.REPLIT_DEPLOYMENT === '1' || 
                        process.env.NODE_ENV === 'production' ||
                        reployName.includes('nonbillableresource');
    
    baseUrl = isReplitApp 
      ? 'https://nonbillableresource.replit.app'
      : `https://${process.env.REPLIT_DEV_DOMAIN}`;
    console.log('🔍 Callback Environment-based detection:', baseUrl);
  }
  
  const redirectUri = `${baseUrl}/auth/callback`;
  console.log('- Callback redirect URI being used:', redirectUri);
    
  const tokenRequest = {
    code,
    scopes: ['user.read', 'Directory.Read.All'],
    redirectUri,
  };

  const response = await client.acquireTokenByCode(tokenRequest);
  return response;
}

export async function getUserInfo(accessToken: string): Promise<any> {
  const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return response.data;
}

async function getSharePointData(listUrl: string, accessToken: string): Promise<any[]> {
  try {
    const response = await axios.get(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json;odata=verbose'
      }
    });
    return response.data.d.results || [];
  } catch (error) {
    console.error('Error fetching SharePoint data:', error);
    return [];
  }
}

export async function getUserPermissions(userEmail: string, accessToken: string): Promise<UserPermissions> {
  const normalizedEmail = userEmail.toLowerCase();
  
  // Check if user has full access
  if (FULL_ACCESS_USERS.includes(normalizedEmail)) {
    return {
      hasFullAccess: true,
      allowedDepartments: [],
      allowedClients: [],
      userEmail: normalizedEmail
    };
  }

  const permissions: UserPermissions = {
    hasFullAccess: false,
    allowedDepartments: [],
    allowedClients: [],
    userEmail: normalizedEmail
  };

  // Check if user has client-based access
  if (CLIENT_BASED_USERS.includes(normalizedEmail)) {
    // Get client permissions from SharePoint
    const clientListUrl = `https://rcyber.sharepoint.com/sites/DataWareHousingRC/_api/web/lists/getbytitle('SecurityConfiguration')/items`;
    const clientData = await getSharePointData(clientListUrl, accessToken);
    
    for (const item of clientData) {
      if (item.DeliveryHead?.toLowerCase() === normalizedEmail || 
          item.PracticeHead?.toLowerCase() === normalizedEmail) {
        permissions.allowedClients.push(item.Title);
      }
    }
  } else {
    // Get department permissions from SharePoint
    const departmentListUrl = `https://rcyber.sharepoint.com/sites/DataWareHousingRC/_api/web/lists/getbytitle('SecurityConfigurationDepartments')/items`;
    const departmentData = await getSharePointData(departmentListUrl, accessToken);
    
    for (const item of departmentData) {
      if (item.PracticeHead?.toLowerCase() === normalizedEmail) {
        permissions.allowedDepartments.push(item.Title);
      }
    }
  }

  return permissions;
}

export function filterEmployeesByPermissions(employees: any[], permissions: UserPermissions): any[] {
  if (permissions.hasFullAccess) {
    return employees;
  }

  return employees.filter(employee => {
    // Client-based filtering
    if (permissions.allowedClients.length > 0) {
      return permissions.allowedClients.includes(employee.client);
    }
    
    // Department-based filtering
    if (permissions.allowedDepartments.length > 0) {
      return permissions.allowedDepartments.includes(employee.department);
    }
    
    // No access
    return false;
  });
}