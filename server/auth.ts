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

// Full access users - based on your requirements table
const FULL_ACCESS_USERS = [
  'mustafa.pesh@royalcyber.com',
  'kishore.kumar@royalcyber.com', 
  'huzefa@royalcyber.com',
  'aravind.dumpala@royalcyber.com',
  'farhan.ahmed@royalcyber.com',
  'rehman.shahid@royalcyber.com',
  'karthik.v@royalcyber.com',
  'lubna.ashraf@royalcyber.com'
];

// Client-based access users
const CLIENT_BASED_USERS = [
  'krishna.k@royalcyber.com',
  'natasha@royalcyber.com',
  'ashok.lakshman@royalcyber.com',
  'timesheet.admin@royalcyber.com'
];

// Business Unit specific access users
const BUSINESS_UNIT_ACCESS_USERS: Record<string, string[]> = {
  'madeeba.shamim@royalcyber.com': ['Emerging Technologies'],
  'basheer@royalcyber.com': ['Digital Transformation'],
  'muhammad.malik@royalcyber.com': ['Digital Transformation'],
  'timesheet.admin@royalcyber.com': ['Emerging Technologies']
};

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
  console.log(`📧 Email comparison - input: "${normalizedEmail}", target: "timesheet.admin@royalcyber.com"`);
  console.log(`📧 Exact match: ${normalizedEmail === 'timesheet.admin@royalcyber.com'}`);
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

  // Check if user has business unit specific access
  if (BUSINESS_UNIT_ACCESS_USERS[normalizedEmail]) {
    console.log(`🏢 Business unit access found for: ${normalizedEmail}`);
    const allowedBusinessUnits = BUSINESS_UNIT_ACCESS_USERS[normalizedEmail];
    console.log(`🏢 Allowed business units: ${JSON.stringify(allowedBusinessUnits)}`);
    
    // For business unit access, we'll filter by business unit in the storage layer
    permissions.allowedDepartments = allowedBusinessUnits;
    return permissions;
  }

  // Check if user has client-based access
  if (CLIENT_BASED_USERS.includes(normalizedEmail)) {
    console.log(`🔍 Processing client permissions for user: ${normalizedEmail}`);
    
    // For timesheet.admin, fetch real-time permissions from SharePoint using delegated token
    if (normalizedEmail === 'timesheet.admin@royalcyber.com') {
      console.log(`🎯 Fetching REAL-TIME SharePoint permissions for timesheet.admin using delegated token`);
      console.log(`🔑 Using user's delegated access token for SharePoint API calls`);
      
      try {
        // First try SharePoint REST API with user's delegated token
        const sharepointRestUrl = `https://rcyber.sharepoint.com/sites/DataWareHousingRC/_api/web/lists/getbytitle('SecurityConfiguration')/items?$filter=DeliveryHead eq 'Time Sheet Admin'&$select=Title,DeliveryHead`;
        console.log(`🔗 Attempting SharePoint REST API: ${sharepointRestUrl}`);
        
        const restResponse = await fetch(sharepointRestUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
          }
        });

        if (restResponse.ok) {
          const restData = await restResponse.json();
          console.log(`📊 SharePoint REST API success:`, JSON.stringify(restData, null, 2));
          
          if (restData.d && restData.d.results && restData.d.results.length > 0) {
            permissions.allowedClients = restData.d.results
              .map((item: any) => item.Title)
              .filter((title: string) => title);
            console.log(`✅ DYNAMIC SharePoint permissions via REST API: ${JSON.stringify(permissions.allowedClients)}`);
            console.log(`📈 Real-time client count: ${permissions.allowedClients.length} clients from SharePoint`);
          } else {
            throw new Error('No items found in SharePoint REST response');
          }
        } else {
          const restError = await restResponse.text();
          console.log(`❌ SharePoint REST API failed (${restResponse.status}): ${restError}`);
          
          // Fallback to Graph API with delegated token
          console.log(`🔄 Trying Microsoft Graph API with delegated token`);
          const graphUrls = [
            `https://graph.microsoft.com/v1.0/sites/rcyber.sharepoint.com:/sites/DataWareHousingRC/lists/SecurityConfiguration/items?$expand=fields&$filter=fields/DeliveryHead eq 'Time Sheet Admin'&$select=fields`,
            `https://graph.microsoft.com/v1.0/sites/rcyber.sharepoint.com/sites/DataWareHousingRC/lists/SecurityConfiguration/items?$expand=fields&$filter=fields/DeliveryHead eq 'Time Sheet Admin'&$select=fields`,
            `https://graph.microsoft.com/v1.0/sites/root/sites/DataWareHousingRC/lists/SecurityConfiguration/items?$expand=fields&$filter=fields/DeliveryHead eq 'Time Sheet Admin'&$select=fields`
          ];
          
          let graphSuccess = false;
          for (const graphUrl of graphUrls) {
            console.log(`🔗 Trying Graph API: ${graphUrl}`);
            try {
              const graphResponse = await fetch(graphUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json'
                }
              });
              
              if (graphResponse.ok) {
                const graphData = await graphResponse.json();
                console.log(`📊 Graph API success:`, JSON.stringify(graphData, null, 2));
                
                if (graphData.value && graphData.value.length > 0) {
                  permissions.allowedClients = graphData.value
                    .map((item: any) => item.fields?.Title)
                    .filter((title: string) => title);
                  console.log(`✅ DYNAMIC SharePoint permissions via Graph API: ${JSON.stringify(permissions.allowedClients)}`);
                  console.log(`📈 Real-time client count: ${permissions.allowedClients.length} clients from SharePoint`);
                  graphSuccess = true;
                  break;
                }
              } else {
                const graphError = await graphResponse.text();
                console.log(`❌ Graph API failed (${graphResponse.status}): ${graphError}`);
              }
            } catch (graphError) {
              console.log(`❌ Graph API error: ${graphError}`);
            }
          }
          
          if (!graphSuccess) {
            throw new Error('All SharePoint API methods failed');
          }
        }
      } catch (error) {
        console.error(`❌ SharePoint integration error:`, error);
        console.log(`🔄 Falling back to known configuration with 3 clients`);
        // Fallback to current known configuration
        permissions.allowedClients = [
          'Work Wear Group Consultancy',
          'PetBarn', 
          'Fletcher Builder'
        ];
        console.log(`⚠️ Using fallback permissions: ${JSON.stringify(permissions.allowedClients)}`);
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
    
    // Business Unit based filtering (for specific users from requirements table)
    if (permissions.allowedDepartments.length > 0) {
      // Check if the user has business unit access (stored in allowedDepartments for business unit users)
      const businessUnitMatch = permissions.allowedDepartments.includes(employee.businessUnit);
      console.log(`🏢 Business unit filtering for employee ${employee.name}:`, {
        employeeBusinessUnit: employee.businessUnit,
        allowedBusinessUnits: permissions.allowedDepartments,
        match: businessUnitMatch
      });
      return businessUnitMatch;
    }
    
    // Department-based filtering (for other users)
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