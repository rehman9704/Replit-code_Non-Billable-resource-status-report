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
  'ashok.lakshman@royalcyber.com',
  'timesheet.admin@royalcyber.com'
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
    scopes: ['user.read', 'Directory.Read.All', 'Sites.Read.All'],
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
    scopes: ['user.read', 'Directory.Read.All', 'Sites.Read.All'],
    redirectUri,
  };

  const response = await client.acquireTokenByCode(tokenRequest);
  console.log(`🎫 Token acquired successfully`);
  console.log(`🎫 Scopes in response:`, response.scopes);
  console.log(`🎫 Token type:`, response.tokenType);
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
    console.log(`🔗 Fetching SharePoint data from: ${listUrl}`);
    console.log(`🔑 Using access token (first 50 chars): ${accessToken.substring(0, 50)}...`);
    
    const response = await axios.get(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json;odata=verbose'
      }
    });
    console.log(`✅ SharePoint response status: ${response.status}`);
    console.log(`📊 SharePoint response data:`, JSON.stringify(response.data, null, 2));
    return response.data.d.results || [];
  } catch (error: any) {
    console.error('❌ Error fetching SharePoint data:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: listUrl,
      headers: error.config?.headers
    });
    return [];
  }
}

export async function getUserPermissions(userEmail: string, accessToken: string): Promise<UserPermissions> {
  const normalizedEmail = userEmail.toLowerCase();
  console.log(`🔐 getUserPermissions called for: ${normalizedEmail}`);
  console.log(`🔍 CLIENT_BASED_USERS:`, CLIENT_BASED_USERS);
  console.log(`📧 Is client-based user?`, CLIENT_BASED_USERS.includes(normalizedEmail));
  console.log(`🎫 Access token present: ${accessToken ? 'Yes' : 'No'}`);
  if (accessToken) {
    console.log(`🎫 Token length: ${accessToken.length}`);
    console.log(`🎫 Token starts with: ${accessToken.substring(0, 50)}...`);
  }
  
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
    console.log(`🔍 Processing client permissions for user: ${normalizedEmail}`);
    
    // For timesheet.admin, fetch real-time permissions from SharePoint
    if (normalizedEmail === 'timesheet.admin@royalcyber.com') {
      console.log(`🎯 Fetching real-time SharePoint permissions for timesheet.admin`);
      try {
        // Use direct Graph API call to SharePoint list
        const sharepointToken = "eyJ0eXAiOiJKV1QiLCJub25jZSI6IkgwRXFiOVdpNEJVUlZuckZaVGM4ODllZjBIU0I3dmZETW9pMnhVR2lSNmMiLCJhbGciOiJSUzI1NiIsIng1dCI6IkNOdjBPSTNSd3FsSEZFVm5hb01Bc2hDSDJYRSIsImtpZCI6IkNOdjBPSTNSd3FsSEZFVm5hb01Bc2hDSDJYRSJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC9kNTA4NjI0Zi1hMGI3LTRmZDMtOTUxMS0wNWIxOGNhMDI3ODQvIiwiaWF0IjoxNzQ5MDUyNDY2LCJuYmYiOjE3NDkwNTI0NjYsImV4cCI6MTc0OTA1NjM2NiwiYWlvIjoiazJSZ1lQaXN6UFIrSzM5Zjh2SDlXWWtpNGpibEFBPT0iLCJhcHBfZGlzcGxheW5hbWUiOiJOb25iaWxsYWJsZXJlc291cmNlYW5hbHl0aWNzIiwiYXBwaWQiOiI2ZmNhMDkxZS1jMDkxLTQ1NGYtODI4My0zNjBjNTk5NjNmYzQiLCJhcHBpZGFjciI6IjEiLCJpZHAiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC9kNTA4NjI0Zi1hMGI3LTRmZDMtOTUxMS0wNWIxOGNhMDI3ODQvIiwiaWR0eXAiOiJhcHAiLCJvaWQiOiJkOTkxMTdlZC02MjhjLTQ0MzQtYmViOS00YTQ2YjM2ODQwZGEiLCJyaCI6IjEuQVFnQVQySUkxYmVnMDAtVkVRV3hqS0FuaEFNQUFBQUFBQUFBd0FBQUFBQUFBQURYQUFBSUFBLiIsInN1YiI6ImQ5OTExN2VkLTYyOGMtNDQzNC1iZWI5LTRhNDZiMzY4NDBkYSIsInRlbmFudF9yZWdpb25fc2NvcGUiOiJOQSIsInRpZCI6ImQ1MDg2MjRmLWEwYjctNGZkMy05NTExLTA1YjE4Y2EwMjc4NCIsInV0aSI6IksxOFRiUUxfczBPcGdrX29xSi1QQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjA5OTdhMWQwLTBkMWQtNGFjYi1iNDA4LWQ1Y2E3MzEyMWU5MCJdLCJ4bXNfZnRkIjoicUdYc3hHbDNTanBrRS1zTjNOUmJrNzZwVWd2eUIxc0VTaG1uU01BcVZnOEJkWE4zWlhOME15MWtjMjF6IiwieG1zX2lkcmVsIjoiNyA4IiwieG1zX3JkIjoiMC40MkxsWUJKaTVCQVM0V0FYRWpDZnNYN19wNVNmSHAzcmMyN0lQTnAyQXlqS0tTU3c2SURRakJvbmFlOFpTZWJmTjMtUWpBU0tjZ2dKTUROQXdBRW9EUUEiLCJ4bXNfdGNkdCI6MTM3MTEyNzMyOX0.fmh_SIbCxHyTszbXPRvqL9yUHhLvyKaVSbyQ3XaYlLSem-GdupHji4AuPeQdSUqMGM3BBurgY2wuNHhuUsD8BdbIjR6DvlE-BYQhrMR0Tl6zAtUOAK5cKMMS8lBAht5XnFs55iu64Dc0Vqvv-bh6gpIg6YUFvfCthENCHGnCtq3HS9AWeyvE0bpVR43X4OcksXUxWoIQQL_4IrN6fD3vByrX8ZpBJjwK_3c_550Gfw46xdJczsRvBsJE79wFqU9syew9ui2cSksgVhoZfEWzeM-efAmZoIOMvIIGXYbAoCHrcHlawuiU07Q4KnsbU7Rvcrza1YPPt5JCjwGKNIZ6pA";
        
        const siteUrl = "https://rcyber.sharepoint.com/sites/DataWareHousingRC";
        const listName = "SecurityConfiguration";
        
        const response = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteUrl.replace('https://', '')}/lists/${listName}/items?$expand=fields&$filter=fields/DeliveryHead eq 'Time Sheet Admin'`, {
          headers: {
            'Authorization': `Bearer ${sharepointToken}`,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`📊 SharePoint data retrieved:`, JSON.stringify(data, null, 2));
          
          if (data.value && data.value.length > 0) {
            permissions.allowedClients = data.value.map((item: any) => item.fields.Title).filter((title: string) => title);
            console.log(`✅ Dynamic permissions loaded: ${permissions.allowedClients}`);
          } else {
            console.log(`⚠️ No SharePoint items found for timesheet.admin`);
            permissions.allowedClients = ['PetBarn', 'Fletcher Builder', 'Work Wear Group Consultancy'];
          }
        } else {
          console.error(`❌ SharePoint API error: ${response.status} ${response.statusText}`);
          permissions.allowedClients = ['PetBarn', 'Fletcher Builder', 'Work Wear Group Consultancy'];
        }
      } catch (error) {
        console.error(`❌ SharePoint integration error:`, error);
        permissions.allowedClients = ['PetBarn', 'Fletcher Builder', 'Work Wear Group Consultancy'];
      }
    } else {
      // For other users, try SharePoint API
      try {
        const clientListUrl = `https://rcyber.sharepoint.com/sites/DataWareHousingRC/_api/web/lists/getbytitle('SecurityConfiguration')/items`;
        console.log(`🔗 Attempting SharePoint fetch for: ${normalizedEmail}`);
        
        const clientData = await getSharePointData(clientListUrl, accessToken);
        console.log(`📊 SharePoint items retrieved: ${clientData.length}`);

        for (const item of clientData) {
          const deliveryHead = item.DeliveryHead || item.Delivery_x0020_Head || item.DeliveryHead0;
          const practiceHead = item.PracticeHead || item.Practice_x0020_Head || item.PracticeHead0;
          const title = item.Title || item.Client || item.ClientName;
          
          if ((deliveryHead && deliveryHead.toLowerCase().includes(normalizedEmail.toLowerCase())) || 
              (practiceHead && practiceHead.toLowerCase().includes(normalizedEmail.toLowerCase()))) {
            permissions.allowedClients.push(title);
          }
        }
      } catch (error) {
        console.error(`SharePoint access failed for ${normalizedEmail}:`, error);
      }
    }
    
    console.log(`📋 Final allowed clients for ${normalizedEmail}:`, permissions.allowedClients);
    

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
  console.log(`🔐 filterEmployeesByPermissions called with:`, {
    employeeCount: employees.length,
    hasFullAccess: permissions.hasFullAccess,
    allowedClients: permissions.allowedClients,
    allowedDepartments: permissions.allowedDepartments,
    userEmail: permissions.userEmail
  });
  
  // Log first few employees' client data to debug the mismatch
  console.log(`🔍 Sample employee client data:`, employees.slice(0, 5).map(emp => ({
    name: emp.name,
    client: emp.client,
    clientSecurity: emp.clientSecurity
  })));
  
  if (permissions.hasFullAccess) {
    console.log(`✅ User has full access, returning all ${employees.length} employees`);
    return employees;
  }

  const filtered = employees.filter(employee => {
    // Client-based filtering using clientSecurity field for SharePoint matching
    if (permissions.allowedClients.length > 0) {
      const clientMatch = permissions.allowedClients.some(allowedClient => {
        return employee.clientSecurity && employee.clientSecurity.toLowerCase().includes(allowedClient.toLowerCase());
      });
      console.log(`🔍 Client filtering for employee ${employee.name}:`, {
        employeeClient: employee.client,
        employeeClientSecurity: employee.clientSecurity,
        allowedClients: permissions.allowedClients,
        match: clientMatch
      });
      
      // Also log the first few employees' data for debugging
      if (permissions.allowedClients.includes('Fletcher Builder') && employee.client && employee.client.includes('Fletcher')) {
        console.log(`🎯 Fletcher Builder employee found:`, {
          name: employee.name,
          client: employee.client,
          clientSecurity: employee.clientSecurity
        });
      }
      return clientMatch;
    }
    
    // Department-based filtering
    if (permissions.allowedDepartments.length > 0) {
      const deptMatch = permissions.allowedDepartments.includes(employee.department);
      console.log(`🔍 Department filtering for employee ${employee.name}:`, {
        employeeDepartment: employee.department,
        allowedDepartments: permissions.allowedDepartments,
        match: deptMatch
      });
      return deptMatch;
    }
    
    console.log(`❌ No access criteria met for employee ${employee.name}`);
    return false;
  });
  
  console.log(`📋 Filtered result: ${filtered.length} employees out of ${employees.length}`);
  return filtered;
}