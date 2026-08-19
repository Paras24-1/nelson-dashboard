const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jncmizoejeaclpnfxazg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY21pem9lamVhY2xwbmZ4YXpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMTczMiwiZXhwIjoyMDkyNzA3NzMyfQ.A8A4tMGzUFuhH4DOSb77QByuKmNdajZ_kCRvr_yxqFo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listMainTables() {
  console.log('Querying public tables in Main Supabase...');
  
  const tables = ['organizations', 'organization_settings', 'users', 'settings', 'credentials', 'voice_settings'];
  const results = {};
  
  for (const table of tables) {
    const { data: testData, error: testErr } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (testErr) {
      results[table] = `Error: ${testErr.message}`;
    } else {
      results[table] = {
        status: 'Exists',
        columns: testData.length > 0 ? Object.keys(testData[0]) : 'Empty table'
      };
    }
  }
  
  console.log('Table checks:');
  console.log(JSON.stringify(results, null, 2));
}

listMainTables();
