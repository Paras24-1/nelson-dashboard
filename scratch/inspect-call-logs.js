const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function inspectLogs() {
  console.log('Querying call_logs in Voice Supabase...');
  const { data, error } = await voiceSupabase
    .from('call_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching call logs:', error);
  } else if (data && data.length > 0) {
    console.log('Successfully fetched sample call log record:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No call log records found.');
  }
}

inspectLogs();
