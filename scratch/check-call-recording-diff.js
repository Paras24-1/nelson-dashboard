const AUTH_ID = 'MA_937EKWJ9';
const AUTH_TOKEN = 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh';
const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function checkCallDetails() {
  // Get a call that has a recording to see what data is saved
  const { data: withRec } = await voiceSupabase
    .from('call_logs')
    .select('*')
    .not('recording_url', 'is', null)
    .limit(2);

  console.log('=== Call WITH recording ===');
  if (withRec?.[0]) console.log(JSON.stringify(withRec[0], null, 2));

  // Get a call without a recording
  const { data: noRec } = await voiceSupabase
    .from('call_logs')
    .select('*')
    .is('recording_url', null)
    .limit(2);

  console.log('\n=== Call WITHOUT recording ===');
  if (noRec?.[0]) console.log(JSON.stringify(noRec[0], null, 2));

  // Check if there's a call_id or external_id we can use to fetch from Vobiz
  console.log('\n=== All columns in a call log ===');
  if (noRec?.[0]) console.log('Keys:', Object.keys(noRec[0]));
}

checkCallDetails();
