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
    
    // For timesheet.admin, fetch real-time permissions from SharePoint using delegated access
    if (normalizedEmail === 'timesheet.admin@royalcyber.com') {
      console.log(`🎯 Fetching real-time SharePoint permissions for timesheet.admin`);
      console.log(`🔑 Using delegated token for SharePoint access`);
      
      try {
        // Use the user's delegated access token to call SharePoint via Graph API
        const searchUrl = `https://graph.microsoft.com/v1.0/search/query`;
        const searchPayload = {
          requests: [{
            entityTypes: ["listItem"],
            query: {
              queryString: "DeliveryHead:\"Time Sheet Admin\" AND ListID:SecurityConfiguration"
            },
            from: 0,
            size: 25,
            fields: ["Title", "DeliveryHead", "listItemId"]
          }]
        };

        console.log(`🔍 Searching SharePoint with Graph Search API`);
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchPayload)
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`📊 SharePoint search response:`, JSON.stringify(searchData, null, 2));
          
          if (searchData.value && searchData.value[0] && searchData.value[0].hitsContainers && 
              searchData.value[0].hitsContainers[0] && searchData.value[0].hitsContainers[0].hits) {
            const hits = searchData.value[0].hitsContainers[0].hits;
            permissions.allowedClients = hits
              .map((hit: any) => hit.resource?.fields?.Title)
              .filter((title: string) => title);
            console.log(`✅ Dynamic SharePoint permissions via Search: ${JSON.stringify(permissions.allowedClients)}`);
          } else {
            console.log(`⚠️ No search results, trying direct list access`);
            
            // Fallback to try direct Graph API calls for lists
            const directUrls = [
              `https://graph.microsoft.com/v1.0/sites/root/sites/DataWareHousingRC/lists/SecurityConfiguration/items?$expand=fields&$filter=fields/DeliveryHead eq 'Time Sheet Admin'`,
              `https://graph.microsoft.com/v1.0/sites/rcyber.sharepoint.com:/sites/DataWareHousingRC/lists/SecurityConfiguration/items?$expand=fields&$filter=fields/DeliveryHead eq 'Time Sheet Admin'`
            ];
            
            let foundData = false;
            for (const url of directUrls) {
              console.log(`🔗 Trying direct access: ${url}`);
              try {
                const directResponse = await fetch(url, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                  }
                });
                
                if (directResponse.ok) {
                  const directData = await directResponse.json();
                  console.log(`📊 Direct access success:`, JSON.stringify(directData, null, 2));
                  if (directData.value && directData.value.length > 0) {
                    permissions.allowedClients = directData.value
                      .map((item: any) => item.fields?.Title)
                      .filter((title: string) => title);
                    foundData = true;
                    break;
                  }
                } else {
                  const errorText = await directResponse.text();
                  console.log(`❌ Direct access failed (${directResponse.status}): ${errorText}`);
                }
              } catch (directError) {
                console.log(`❌ Direct access error: ${directError}`);
              }
            }
            
            if (!foundData) {
              console.log(`⚠️ All SharePoint access methods failed, using current configuration`);
              permissions.allowedClients = ['PetBarn', 'Fletcher Builder', 'Work Wear Group Consultancy', 'YDesign Group'];
            }
          }
        } else {
          const errorText = await searchResponse.text();
          console.error(`❌ SharePoint search failed: ${searchResponse.status} - ${errorText}`);
          permissions.allowedClients = ['PetBarn', 'Fletcher Builder', 'Work Wear Group Consultancy', 'YDesign Group'];
        }
        
        console.log(`📈 Final client count: ${permissions.allowedClients.length} clients`);
        
      } catch (error) {
        console.error(`❌ SharePoint integration error:`, error);
        permissions.allowedClients = ['PetBarn', 'Fletcher Builder', 'Work Wear Group Consultancy', 'YDesign Group'];
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