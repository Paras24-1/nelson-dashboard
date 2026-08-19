const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function checkStatuses() {
  // Get all distinct statuses used in campaigns
  const { data, error } = await voiceSupabase
    .from('campaigns')
    .select('id, name, status')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Recent campaigns and their statuses:');
    data.forEach(c => console.log(`  ${c.status} | ${c.name}`));
    
    const statuses = [...new Set(data.map(c => c.status))];
    console.log('\nDistinct statuses found:', statuses);
  }
}

checkStatuses();
