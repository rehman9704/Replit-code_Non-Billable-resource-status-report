import sql from 'mssql';

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Client mappings from auth.ts
const clientMappings = {
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
  'fnu.sudha@royalcyber.com': [
    'PSCU Incorporated', 'Smith Drug Company', 'Southwest Business Corporation (SWBC)',
    'Tradeweb Markets LLC', 'ZTR Control Systems', 'Aon Integramark', 'ArcelorMittal Dofasco G.P',
    'Bombardier Inc.', 'CDW Technologies LLC', 'Essent Guaranty, inc', 'Heitman LLC.',
    'Mainline Information Systems Inc.', 'Mars Information Services Inc.', 'Norquest'
  ],
  'hussain@royalcyber.com': [
    'Adtalem Global Education Inc.', 'Niagara Bottling', 'Northwestern University',
    'SigniFi Solution', 'Tesno Inc,', 'The University of Chicago',
    'The University of Chicago, Booth School of Business'
  ],
  'chirag.intwala@royalcyber.com': [
    'ProcurePro Inc.', 'Quantrax Corporation Inc', 'Bank Of America (BOA)', 'Cloudreach Inc',
    'IBM', 'IBM-Avis'
  ],
  'abhaideep.s@royalcyber.com': [
    'Texas Roadhouse, Inc.', 'The Kroger Co.', 'Humana Inc.', 'Humana-IBM'
  ],
  'krishna.k@royalcyber.com': [
    'Augusta Sportswear', 'JE Dunn', 'Knights of Columbus'
  ],
  'biswadeep.sarkar@royalcyber.com': [
    'American Express', 'Capital One Services, LLC', 'Globe Life And Accident Insurance  Company'
  ],
  'victor.vaz@royalcyber.com': [
    'Caesars Entertainment Operating Company', 'Mattress Firm Inc.'
  ],
  'naseer@royalcyber.com': [
    'Amex', 'Aramark'
  ],
  'timesheet.admin@royalcyber.com': ['1800 Lighting'],
  'yash.sokhiya@royalcyber.com': [
    'Booqat International Services'
  ],
  'dinesh.arora@royalcyber.com': [
    'VDA Infoslutions Pvt. Ltd.'
  ],
  'leela.shankar@royalcyber.com': [
    'Aroya Cruises Limited'
  ]
};

async function checkEmployeeCounts() {
  let pool;
  try {
    pool = await sql.connect(config);
    
    console.log('Employee counts by user client access:');
    console.log('=====================================');
    
    for (const [userEmail, clients] of Object.entries(clientMappings)) {
      if (clients.length === 0) {
        console.log(`${userEmail}: 0 employees (no clients assigned)`);
        continue;
      }
      
      // Create parameterized query
      const clientList = clients.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      const query = `SELECT COUNT(*) as count FROM MergedData WHERE [Client Name_Security] IN (${clientList})`;
      
      try {
        const result = await pool.request().query(query);
        const count = result.recordset[0].count;
        console.log(`${userEmail}: ${count} employees (${clients.length} clients assigned)`);
      } catch (error) {
        console.log(`${userEmail}: Error querying - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Database connection error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkEmployeeCounts();