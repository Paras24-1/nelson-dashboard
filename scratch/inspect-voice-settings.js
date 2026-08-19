const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdDRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function inspectOrgSettings() {
  console.log('Querying organizations in Voice Supabase...');
  const { data, error } = await voiceSupabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching org settings:', error);
  } else {
    console.log('Voice Org Record Schema & Values:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

inspectOrgSettings();
