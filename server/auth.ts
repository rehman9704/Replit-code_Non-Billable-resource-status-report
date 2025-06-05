import { ConfidentialClientApplication } from "@azure/msal-node";
import axios from "axios";

const clientConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
  }
};

function getAzureClient() {
  return new ConfidentialClientApplication(clientConfig);
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

// Client-based access users - updated based on latest revised Excel list from user
const CLIENT_BASED_ACCESS_MAPPING: Record<string, string[]> = {
  // Emerging Technologies Business Unit
  'hassan.mounireddin@royalcyber.com': ['Adaptonn Global Education Inc.', 'Ringier Africa', 'Sigrid Solutions', 'TerraOta'],
  'karthik.n@royalcyber.com': ['Adaptonn Global Education Inc.', 'Ringier Africa', 'Sigrid Solutions', 'TerraOta'],
  'mahish@royalcyber.com': ['The Wandering Bee App - Boost N level of Business'],
  'siddartha@royalcyber.com': ['Upstreamed Entertainment'],
  'tinu.shanmugam@royalcyber.com': ['The Saudi Investment Bank'],
  
  // Digital Commerce Business Unit
  'abhijit.lakshman@royalcyber.com': ['Oil & Wrench Lubricants Limited', 'Edrich Inc', 'Electric Building - MECO', 'Electric Venture Limited', 'Elevator Systems Pte. Ltd', 'Gulftainer Group Limited', 'JA & Associates - Office', 'MECO Exchange', 'DECO Exchange', 'Oil Tech', 'Oil Well Steel', 'LONGITUDE GLOBAL LIMITED (UAEI-CENTRO)', 'JA South Africa Beverages Manufacturing Company', 'Malaysian National Reinsurance Berhad', 'Oasis Active Gear', 'United Refrigeration Industries Ltd. (UAEI-AMCF)', 'Velocity Limited', 'West Wind Group Consultancy'],
  
  // Digital Transformation Business Unit  
  'aishwarya.khanna@royalcyber.com': ['Ameet Company', 'Anotech Nanosync India Limited', 'ARINC Incorporated', 'Brightconn Inc.', 'Challenge Inc.', 'Chemicon Global Limited', 'Citilink Networks', 'Devace & Friends', 'Fabric Commerce Inc. (WLI Fox)', 'Falkan Commerce Inc.', 'Food Venture-Al Madina Chicken Co. (WLI Fox)', 'Fortune Brands (Global Plumbing Group)', 'Genesys', 'Gistotech', 'HC Simply Support Services, Inc.', 'High Technology Services Corp', 'INSITU Inc.', 'LensGesic Inc.', 'Limra Financial Services', 'MCC Simply Support Services, Inc.', 'MEDELIT Inc.', 'Nelsen', 'Nuendo Results', 'Okaya DL', 'Optimal International Trading Corp.', 'Premier Healthcare Alliance', 'Royal Clothing Trading Company', 'SIRIUS TECH', 'Black WBot Corporation', 'Summit Beverages Inc', 'Techrite Systems Inc.', 'Toffel', 'United Fremont LLC', 'White Cap Supply Holdings, LLC.', 'Verispan Ltd.'],
  
  // Individual Digital Transformation users
  'krishna.sai.myneni@royalcyber.com': ['Augusta Southwest'],
  'divyesh.arora@royalcyber.com': ['CAP Plus'],
  'chaitanya@royalcyber.com': ['Empire of Columbus'],
  'sagnik@royalcyber.com': ['Eco Aware Inc.'],
  'taruni@royalcyber.com': ['Evergreen Holdings'],
  'ravi.sudheesh@royalcyber.com': ['Alcade Real Defense D P'],
  'fnu.sudha@royalcyber.com': ['Anna Concepts & Interior Designing'],
  'sireesha.sankireddy@royalcyber.com': ['B & M International Inc.'],
  'benjamin@royalcyber.com': ['California Pacific Medical Center'],
  'sweettiibecca.sankireddy@royalcyber.com': ['Career One Services, LLC'],
  'chirag.shrivastava@royalcyber.com': ['FKI Technologies', 'Essentra Packaging', 'Harnard LLC', 'Humeratech', 'ISIS', 'OEM ASIA', 'Myo Information Services Inc', 'Niklaus Ltd.', 'PMJ Sudha', 'ProGrafics Inc.', 'PSQ Inc Global Services Inc.', 'Summit Diagnostics (SWAMJIC)', 'Suresh Shah Company', 'Technical Services Partnership'],
  'abhishek.sreeshanth@royalcyber.com': ['The Kojeer Co.'],
  'dinesh.aroda@royalcyber.com': ['Universal Hygiene Products', 'VHA Information Pvt. Ltd.'],
  'ankita.tuli@royalcyber.com': ['V J Tax Shop'],
  
  // Time Sheet Admin - using actual client names that exist in database for the employees they should see
  'timesheet.admin@royalcyber.com': ['Knights of Columbus', 'United Refrigeration Industries Ltd. (DAWLANCE)', 'Work Wear Group Consultancy']
};

// Extract all client-based users from the mapping
const CLIENT_BASED_USERS = Object.keys(CLIENT_BASED_ACCESS_MAPPING);

// Business Unit specific access users
const BUSINESS_UNIT_ACCESS_USERS: Record<string, string[]> = {
  'madeeba.shamim@royalcyber.com': ['Emerging Technologies'],
  'basheer@royalcyber.com': ['Digital Transformation'],
  'muhammad.malik@royalcyber.com': ['Digital Transformation']
};

export async function getAuthUrl(req?: any): Promise<string> {
  const client = getAzureClient();
  
  // Detect domain from the actual request if available
  let redirectUri = 'http://127.0.0.1:5000/auth/callback';
  
  if (req) {
    const host = req.get('host') || req.headers.host;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    
    console.log('Request host:', host);
    console.log('Request protocol:', protocol);
    
    if (host) {
      if (host.includes('replit.dev')) {
        redirectUri = `https://${host}/auth/callback`;
        console.log('🔍 Request-based detection:', `https://${host}`);
      } else if (host.includes('127.0.0.1') || host.includes('localhost')) {
        redirectUri = `http://${host}/auth/callback`;
        console.log('🔍 Request-based detection:', `http://${host}`);
      } else {
        redirectUri = `${protocol}://${host}/auth/callback`;
        console.log('🔍 Request-based detection:', `${protocol}://${host}`);
      }
    }
  }
  
  console.log('- Auth redirect URI being used:', redirectUri);

  const authCodeUrlParameters = {
    scopes: ["openid", "profile", "email", "User.Read", "Sites.Read.All", "Directory.Read.All", "GroupMember.Read.All"],
    redirectUri: redirectUri,
  };

  try {
    const response = await client.getAuthCodeUrl(authCodeUrlParameters);
    console.log('Generated auth URL (first 100 chars):', response.substring(0, 100) + '...');
    return response;
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw error;
  }
}

export async function handleCallback(code: string, req?: any): Promise<any> {
  const client = getAzureClient();
  
  // Use the same logic to detect redirect URI
  let redirectUri = 'http://127.0.0.1:5000/auth/callback';
  
  if (req) {
    const host = req.get('host') || req.headers.host;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    
    if (host) {
      if (host.includes('replit.dev')) {
        redirectUri = `https://${host}/auth/callback`;
      } else if (host.includes('127.0.0.1') || host.includes('localhost')) {
        redirectUri = `http://${host}/auth/callback`;
      } else {
        redirectUri = `${protocol}://${host}/auth/callback`;
      }
    }
  }

  const tokenRequest = {
    code: code,
    scopes: ["openid", "profile", "email", "User.Read", "Sites.Read.All", "Directory.Read.All", "GroupMember.Read.All"],
    redirectUri: redirectUri,
  };

  try {
    const response = await client.acquireTokenByCode(tokenRequest);
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresOn: response.expiresOn
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
}

export async function getUserInfo(accessToken: string): Promise<any> {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
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
    
    permissions.allowedDepartments = allowedBusinessUnits;
    return permissions;
  }

  // Check if user has client-based access
  if (CLIENT_BASED_USERS.includes(normalizedEmail)) {
    console.log(`🔍 Processing client permissions for user: ${normalizedEmail}`);
    
    if (CLIENT_BASED_ACCESS_MAPPING[normalizedEmail]) {
      permissions.allowedClients = CLIENT_BASED_ACCESS_MAPPING[normalizedEmail];
      console.log(`✅ Using predefined client access for ${normalizedEmail}:`, permissions.allowedClients);
      return permissions;
    }
  }

  // Check for users who should have NO ACCESS to the system
  const hasAnyAccess = FULL_ACCESS_USERS.includes(normalizedEmail) || 
                      BUSINESS_UNIT_ACCESS_USERS[normalizedEmail] || 
                      CLIENT_BASED_USERS.includes(normalizedEmail);
  
  if (!hasAnyAccess) {
    console.log(`❌ No access rights found for user: ${normalizedEmail}`);
    return {
      hasFullAccess: false,
      allowedDepartments: [],
      allowedClients: ['NO_ACCESS_GRANTED'],
      userEmail: normalizedEmail
    };
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
  
  if (permissions.hasFullAccess) {
    console.log(`✅ User has full access, returning all ${employees.length} employees`);
    return employees;
  }

  if (permissions.allowedClients.includes('NO_ACCESS_GRANTED')) {
    console.log(`🚫 User has no access, returning empty list`);
    return [];
  }

  if (permissions.allowedDepartments.length > 0) {
    const filtered = employees.filter(emp => 
      permissions.allowedDepartments.includes(emp.businessUnit)
    );
    console.log(`🏢 Business unit filter applied: ${filtered.length} employees`);
    return filtered;
  }

  if (permissions.allowedClients.length > 0) {
    const filtered = employees.filter(emp => 
      permissions.allowedClients.includes(emp.clientSecurity)
    );
    console.log(`🔐 Client filter applied: ${filtered.length} employees`);
    return filtered;
  }

  console.log(`📋 Filtered result: 0 employees out of ${employees.length}`);
  return [];
}