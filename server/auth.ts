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
  'karthik.v@royalcyber.com',
  'lubna.ashraf@royalcyber.com'
];

// Final client-based access mapping from complete revised Excel list
const CLIENT_BASED_ACCESS_MAPPING: Record<string, string[]> = {
  'hassan.mounireddin@royalcyber.com': ['Adaptonn Global Education Inc.'],
  'karthik.n@royalcyber.com': ['Ringier Africa'],
  'mahish@royalcyber.com': ['Sigrid Solutions'],
  'siddartha@royalcyber.com': ['TerraOta'],
  'tinu.shanmugam@royalcyber.com': ['The Wandering Bee App - Boost N level of Business'],
  'abhijit.lakshman@royalcyber.com': ['Upstreamed Entertainment'],
  'krishna.sai.myneni@royalcyber.com': ['Oil & Wrench Lubricants Limited'],
  'divyesh.arora@royalcyber.com': ['Edrich Inc'],
  'chaitanya@royalcyber.com': ['Electric Building - MECO'],
  'sagnik@royalcyber.com': ['Electric Venture Limited'],
  'taruni@royalcyber.com': ['Elevator Systems Pte. Ltd'],
  'ravi.sudheesh@royalcyber.com': ['Gulftainer Group Limited'],
  'fnu.sudha@royalcyber.com': ['JA & Associates - Office'],
  'sireesha.sankireddy@royalcyber.com': ['MECO Exchange'],
  'benjamin@royalcyber.com': ['DECO Exchange'],
  'sweettiibecca.sankireddy@royalcyber.com': ['Oil Tech'],
  'chirag.shrivastava@royalcyber.com': ['Oil Well Steel'],
  'abhishek.sreeshanth@royalcyber.com': ['LONGITUDE GLOBAL LIMITED (UAEI-CENTRO)'],
  'dinesh.aroda@royalcyber.com': ['JA South Africa Beverages Manufacturing Company'],
  'ankita.tuli@royalcyber.com': ['Malaysian National Reinsurance Berhad'],
  'abhishek.sai.srivastava@royalcyber.com': ['Oasis Active Gear'],
  'ankitha@royalcyber.com': ['United Refrigeration Industries Ltd. (UAEI-AMCF)'],
  'arul@royalcyber.com': ['Velocity Limited'],
  
  // Complete aishwarya.khanna client assignments from final Excel
  'aishwarya.khanna@royalcyber.com': [
    'West Wind Group Consultancy', 'INSITU Inc', 'Ameet Company', 'Anotech Nanosync India Limited',
    'ARINC Incorporated', 'Brightconn Inc.', 'Challenge Inc.', 'Chemicon Global Limited',
    'Citilink Networks', 'Devace & Friends', 'Digital Solution', 'Fabric Commerce Inc. (WLI Fox)',
    'Falkan Commerce Inc.', 'Food Venture-Al Madina Chicken Co. (WLI Fox)',
    'Fortune Brands (Global Plumbing Group)', 'Genesys', 'Gistotech',
    'HC Simply Support Services, Inc.', 'High Technology Services Corp', 'LensGesic Inc.',
    'Limra Financial Services', 'MCC Simply Support Services, Inc.', 'MEDELIT Inc.',
    'Nelsen', 'Niagara Bottling', 'Nuendo Results', 'Okaya DL',
    'Optimal International Trading Corp.', 'Premier Healthcare Alliance',
    'Royal Clothing Trading Company', 'SIRIUS TECH', 'Black WBot Corporation',
    'Summit Beverages Inc', 'Techrite Systems Inc.', 'Toffel', 'United Fremont LLC',
    'White Cap Supply Holdings, LLC.', 'Verispan Ltd.', 'Augusta Southwest',
    'CAP Plus', 'Empire of Columbus', 'Eco Aware Inc.', 'Evergreen Holdings',
    'Anna Concepts & Interior Designing', 'Alcade Real Defense D P', 'Harnard LLC',
    'Bommallatii Inc.', 'California Pacific Medical Center', 'Career One Services, LLC',
    'FKI Technologies', 'Essentra Packaging', 'Humeratech', 'ISIS', 'OEM ASIA',
    'Myo Information Services Inc', 'Niklaus Ltd.', 'PMJ Sudha', 'ProGrafics Inc.',
    'PSQ Inc Global Services Inc.', 'Summit Diagnostics (SWAMJIC)', 'Suresh Shah Company',
    'Technical Services Partnership', 'The Kojeer Co.', 'Universal Hygiene Products',
    'VHA Information Pvt. Ltd.', 'V J Tax Shop', 'American Express', 'Eco Link Global',
    'Emirates Airlines', 'IBM', 'Aramark', 'American Express', 'Alco Real Defense D P',
    'Anna Concepts & Interior Designing', 'Bommallatii Inc', 'Career One Services, LLC',
    'Emirates Airlines', 'Global Link Consultancy Pvt. Ltd.', 'Harnard LLC',
    'California Pacific Medical Center', 'FKI Technologies', 'Essentra Packaging',
    'Global GA And Assets Operating Company LLC', 'Health', 'Humana Inc', 'ISIS',
    'IAA Inc', 'IMPACT', 'IBM-M', 'Kyocera', 'MEDELIT Inc', 'Northside Hospital',
    'NEC ASIA', 'OEM ASIA', 'Myo Information Services Inc', 'Niklaus Ltd',
    'PSQ Inc Global Services Inc', 'PMJ Sudha', 'ProGrafics Inc',
    'Summit Diagnostics (SWAMJIC)', 'Suresh Shah Company', 'Technical Services Partnership',
    'Tyson Food', 'Universal Hygiene Products', 'VHA Information Pvt. Ltd.',
    'V J Tax Shop', 'ABC University', 'Abrene Consultants P', 'Amstron Corporation',
    'ATI Physical Therapy', 'Al Jazeera Media Network', 'Aramco', 'Barrus International Service',
    'Bombardier Healthcare', 'Blue Diamond Limited', 'Carrefour', 'Cross-Border Payments Inc',
    'ClickBack Inc', 'Cloudera Inc', 'ConsaHealth Inc', 'DynaTrace Inc',
    'Gallagher Group Limited', 'Havells', 'Humeratech', 'iSoft Data Systems Ltd',
    'Kyocera', 'Marshall Cavendish Education', 'MERKLE INC', 'Norquest',
    'Kyocera Management System Inc', 'National Health Service (NHS)', 'Oasis Active Gear',
    'Princeton Inc', 'PWC', 'Rocket Software', 'SPI Solutions Pvt. Ltd.',
    'Synthetics Inc', 'Terralogic Inc', 'United Farmers of Alberta Co-operative Limited (UFA)',
    'VHA Information Pvt. Ltd.', 'WaterShed Brands'
  ],
  
  // Admin and testing users
  'timesheet.admin@royalcyber.com': ['Aramark'],
  'rehman.shahid@royalcyber.com': ['Aramark']
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