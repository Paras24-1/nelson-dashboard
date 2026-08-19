const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdDRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function listTables() {
  console.log('Querying public tables in Voice Supabase...');
  
  // Try querying table names from pg_catalog
  const { data, error } = await voiceSupabase
    .rpc('get_tables'); // Check if a custom RPC exists, if not we will query via standard REST query on a common table
    
  if (error) {
    // If RPC doesn't exist, try querying some tables directly to see if they exist
    const tables = ['organizations', 'campaigns', 'campaign_contacts', 'call_logs', 'agents', 'settings', 'voice_credentials'];
    const results = {};
    
    for (const table of tables) {
      const { data: testData, error: testErr } = await voiceSupabase
        .from(table)
        .select('*')
        .limit(1);
      results[table] = testErr ? `Error: ${testErr.message}` : 'Exists';
    }
    console.log('Table existence checks:');
    console.log(results);
  } else {
    console.log('Tables:', data);
  }
}

listTables();
