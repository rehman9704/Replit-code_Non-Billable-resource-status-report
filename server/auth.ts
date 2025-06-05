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
  allowedBusinessUnits: string[];
  userEmail: string;
  isDepartmentBasedAccess: boolean;
  isClientBasedAccess: boolean;
  isBusinessUnitBasedAccess: boolean;
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
  'mas@royalcyber.com',
  'kishore.kumar@royalcyber.com', 
  'huzefa@royalcyber.com',
  'aravind.dumpala@royalcyber.com',
  'farhan.ahmed@royalcyber.com',
  'rehman.shahid@royalcyber.com',
  'karthik.v@royalcyber.com',
  'lubna.ashraf@royalcyber.com'
];

// Department-based access mapping
const DEPARTMENT_BASED_ACCESS_MAPPING: Record<string, string[]> = {
  'hussain@royalcyber.com': [
    'AI Innovation', 'Data & AI', 'Data Engineering', 'Data Science', 
    'Inside Sales - ET', 'MS Fabric Solution', 'PMO-ET'
  ],
  'asad.jobanputra@royalcyber.com': ['ClassBuddy', 'Go Test pro'],
  'adnan.maqsood@royalcyber.com': ['QA Testing'],
  'abdul.wahab@royalcyber.com': ['SAP'],
  'kishore.kumar@royalcyber.com': ['UI', 'Business Analysis', 'UX'],
  'asiflala@royalcyber.com': ['Mobile', 'OMS', 'Salesforce'],
  'awais.tariq@royalcyber.com': ['Business Intelligence'],
  'mahaveer@royalcyber.com': [
    '3D Plus', 'Adobe', 'Big Commerce', 'Commercetools', 
    'Customer Data Platform', 'Optimizely', 'VTEX'
  ],
  'zeeshan.mukhtar@royalcyber.com': [
    'Fullstack Services', 'Microsoft Dynamics', 'Microsoft Sharepoint'
  ],
  'brijesh@royalcyber.com': ['ServiceNow'],
  'musthafa.pasha@royalcyber.com': ['Middleware'],
  'abdul.haseeb@royalcyber.com': ['Cloud Solution'],
  'ganeswar.sethi@royalcyber.com': ['Mainframe'],
  'asif.hussain@royalcyber.com': ['RPA']
};

// Complete client-based access mapping from final text format provided
const CLIENT_BASED_ACCESS_MAPPING: Record<string, string[]> = {
  // Build mapping from the provided text format
  'fakhruddin@royalcyber.com': [
    'Tradeweb Markets LLC', 'VDA Infoslutions Pvt. Ltd.', 'ZTR Control Systems', 'IBM-Avis',
    'Mainline Information Systems Inc.', 'Mars Information Services Inc.', 'Mattress Firm Inc.',
    'Norquest', 'ProcurePro Inc.', 'PSCU Incorporated', 'Quantrax Corporation Inc',
    'Smith Drug Company', 'Southwest Business Corporation (SWBC)', 'Texas Roadhouse, Inc.',
    'The Kroger Co.', 'American Express', 'Aon Integramark', 'ArcelorMittal Dofasco G.P',
    'Aroya Cruises Limited', 'Bank Of America (BOA)', 'Bombardier Inc.', 'Booqat International Services',
    'Caesars Entertainment Operating Company', 'Capital One Services, LLC', 'CDW Technologies LLC',
    'Cloudreach Inc', 'Essent Guaranty, inc', 'Globe Life And Accident Insurance  Company',
    'Heitman LLC.', 'Humana Inc.', 'Humana-IBM', 'IBM'
  ],
  
  'natasha@royalcyber.com': [
    'S&P Global Inc.', 'Tanisha Systems Inc.', 'The Select Group', 
    'United Farmers of Alberta Co-operative Limited (UFA)', 'White Cap Supply Holdings, LLC.',
    'Xcelacore Inc', 'YDesign Group', '1800 Lighting', 'Abercrombie & Fitch Co.',
    'Amarr Company', 'Beckett Collectibles, LLC', 'Bramble Berry', 'Brightcove Inc',
    'Bynder LLC', 'Cornerstone Building Brands', 'Crecera Brands', 'David\'s Bridal',
    'Deciem Inc.', 'Follett Corporation', 'Food Ventures North America, Inc. (Wild Fork)',
    'Fortune Brands Global Plumbing Group', 'Guru Denim LLC.', 'HCL Software Inc.',
    'HD Supply Support Services, Inc.', 'Indigo Books & Music Inc.', 'Kyocera',
    'LiveArea Inc.', 'Loop Paper Recycling, Inc.', 'Mars Information Services Inc.',
    'MERKLE INC.', 'Momentec Brands', 'MooseJaw', 'Novant Health', 'Omega Engineering, Inc',
    'Pacific Best Inc', 'Premier Healthcare Alliance', 'Rent-A-Center Texas, L.P',
    'Rich Products Corporation', 'Rock West Composites'
  ],
  
  'ashok.lakshman@royalcyber.com': [
    'Advanced Electronics Co. Ltd.', 'Astellar Technologies Private Limited', 
    'Dr. Reddy\'s Laboratories Limited', 'Fletcher Builder', 'Fletcher Building',
    'Fletcher Building - Laminex', 'Fletcher Building - MICO', 'Fletcher Building - PlaceMakers',
    'Fletcher Building - TradeLink', 'Gallagher Group Limited', 'GWA Group Limited',
    'JSW One Platforms Limited', 'KIECO Exchange', 'Kina Bank', 
    'LOUDCLOUD SYSTEMS PRIVATE LIMITED', 'Middle East & North Africa Beverages Manufacturing Company (MENABEV)',
    'PetBarn', 'Richardson Sports', 'United Refrigeration Industries Ltd. (DAWLANCE)',
    'United Refrigeration Industries Ltd. (Hitachi)', 'Vinod Patel Group', 'Work Wear Group Consultancy'
  ],
  
  'krishna.k@royalcyber.com': [
    'Augusta Sportswear', 'JE Dunn', 'Knights of Columbus'
  ],
  
  'biswadeep.sarkar@royalcyber.com': [
    'American Express', 'Capital One Services, LLC', 'Globe Life And Accident Insurance  Company'
  ],
  
  'fnu.sudha@royalcyber.com': [
    'PSCU Incorporated', 'Smith Drug Company', 'Southwest Business Corporation (SWBC)',
    'Tradeweb Markets LLC', 'ZTR Control Systems', 'Aon Integramark', 'ArcelorMittal Dofasco G.P',
    'Bombardier Inc.', 'CDW Technologies LLC', 'Essent Guaranty, inc', 'Heitman LLC.',
    'Mainline Information Systems Inc.', 'Mars Information Services Inc.', 'Norquest'
  ],
  
  'chirag.intwala@royalcyber.com': [
    'ProcurePro Inc.', 'Quantrax Corporation Inc', 'Bank Of America (BOA)', 'Cloudreach Inc',
    'IBM', 'IBM-Avis'
  ],
  
  'abhaideep.s@royalcyber.com': [
    'Texas Roadhouse, Inc.', 'The Kroger Co.', 'Humana Inc.', 'Humana-IBM'
  ],
  
  'dinesh.arora@royalcyber.com': [
    'VDA Infoslutions Pvt. Ltd.'
  ],
  
  'yash.sokhiya@royalcyber.com': [
    'Booqat International Services'
  ],
  
  'victor.vaz@royalcyber.com': [
    'Caesars Entertainment Operating Company', 'Mattress Firm Inc.'
  ],
  
  'leela.shankar@royalcyber.com': [
    'Aroya Cruises Limited'
  ],
  
  'naseer@royalcyber.com': [
    'Amex', 'Aramark'
  ],
  
  'hussain@royalcyber.com': [
    'Adtalem Global Education Inc.', 'Niagara Bottling', 'Northwestern University',
    'SigniFi Solution', 'Tesno Inc,', 'The University of Chicago',
    'The University of Chicago, Booth School of Business'
  ],
  
  // Test users
  'rehman.shahid@royalcyber.com': ['Aramark']
};

// Extract all client-based users from the mapping
const CLIENT_BASED_USERS = Object.keys(CLIENT_BASED_ACCESS_MAPPING);

// Extract all department-based users from the mapping
const DEPARTMENT_BASED_USERS = Object.keys(DEPARTMENT_BASED_ACCESS_MAPPING);

// Business Unit specific access users
const BUSINESS_UNIT_ACCESS_USERS: Record<string, string[]> = {
  'madeeha.shamim@royalcyber.com': ['Emerging Technologies'],
  'basheer@royalcyber.com': ['Digital Transformation'],
  'muhammad.malik@royalcyber.com': ['Digital Transformation'],
  'timesheet.admin@royalcyber.com': ['Emerging Technologies']
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
      allowedBusinessUnits: [],
      userEmail: normalizedEmail,
      isDepartmentBasedAccess: false,
      isClientBasedAccess: false,
      isBusinessUnitBasedAccess: false
    };
  }

  const permissions: UserPermissions = {
    hasFullAccess: false,
    allowedDepartments: [],
    allowedClients: [],
    allowedBusinessUnits: [],
    userEmail: normalizedEmail,
    isDepartmentBasedAccess: false,
    isClientBasedAccess: false,
    isBusinessUnitBasedAccess: false
  };

  // Check if user has department-based access
  if (DEPARTMENT_BASED_USERS.includes(normalizedEmail)) {
    console.log(`🏢 Department-based access found for: ${normalizedEmail}`);
    const allowedDepartments = DEPARTMENT_BASED_ACCESS_MAPPING[normalizedEmail];
    console.log(`🏢 Allowed departments: ${JSON.stringify(allowedDepartments)}`);
    
    permissions.allowedDepartments = allowedDepartments;
    permissions.isDepartmentBasedAccess = true;
    return permissions;
  }

  // Check if user has business unit specific access
  if (BUSINESS_UNIT_ACCESS_USERS[normalizedEmail]) {
    console.log(`🏢 Business unit access found for: ${normalizedEmail}`);
    const allowedBusinessUnits = BUSINESS_UNIT_ACCESS_USERS[normalizedEmail];
    console.log(`🏢 Allowed business units: ${JSON.stringify(allowedBusinessUnits)}`);
    
    permissions.allowedBusinessUnits = allowedBusinessUnits;
    permissions.isBusinessUnitBasedAccess = true;
    return permissions;
  }

  // Check if user has client-based access
  if (CLIENT_BASED_USERS.includes(normalizedEmail)) {
    console.log(`🔍 Processing client permissions for user: ${normalizedEmail}`);
    
    if (CLIENT_BASED_ACCESS_MAPPING[normalizedEmail]) {
      permissions.allowedClients = CLIENT_BASED_ACCESS_MAPPING[normalizedEmail];
      permissions.isClientBasedAccess = true;
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
      allowedBusinessUnits: [],
      userEmail: normalizedEmail,
      isDepartmentBasedAccess: false,
      isClientBasedAccess: false,
      isBusinessUnitBasedAccess: false
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