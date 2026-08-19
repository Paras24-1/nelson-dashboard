const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

const AUTH_ID = 'MA_937EKWJ9';
const AUTH_TOKEN = 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh';

async function fetchRecordingForSid(callSid) {
  // Try to get the recording URL via Vobiz API
  const url = `https://api.vobiz.ai/api/v1/Account/${AUTH_ID}/Call/${callSid}/Recording/`;
  const res = await fetch(url, {
    headers: {
      'X-Auth-ID': AUTH_ID,
      'X-Auth-Token': AUTH_TOKEN
    }
  });
  const text = await res.text();
  return { status: res.status, body: text.substring(0, 300) };
}

async function checkMissingRecordings() {
  // Find calls with no recording but with a call_sid
  const { data, error } = await voiceSupabase
    .from('call_logs')
    .select('id, call_sid, to_phone_number, created_at, status')
    .is('recording_url', null)
    .not('call_sid', 'is', null)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} completed calls with call_sid but no recording_url`);
  
  for (const call of (data || [])) {
    console.log(`\nCall ${call.id} (sid: ${call.call_sid}, to: ${call.to_phone_number})`);
    const result = await fetchRecordingForSid(call.call_sid);
    console.log(`  Vobiz API → status: ${result.status}, body: ${result.body}`);
  }

  // Also check total counts
  const { count: totalNull } = await voiceSupabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .is('recording_url', null);

  const { count: nullWithSid } = await voiceSupabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .is('recording_url', null)
    .not('call_sid', 'is', null);

  console.log(`\n=== Stats ===`);
  console.log(`Total calls with no recording: ${totalNull}`);
  console.log(`Calls with no recording but have call_sid: ${nullWithSid}`);
}

checkMissingRecordings();
