const AUTH_ID = 'MA_937EKWJ9';
const AUTH_TOKEN = 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh';
const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

const headers = {
  'X-Auth-ID': AUTH_ID,
  'X-Auth-Token': AUTH_TOKEN,
  'Content-Type': 'application/json'
};

async function fetchRecordingForSid(callSid) {
  // Try fetching recordings for a specific call from Vobiz
  const endpoints = [
    `https://api.vobiz.ai/api/v1/Account/${AUTH_ID}/Call/${callSid}/Recording/`,
    `https://api.vobiz.ai/v1/Account/${AUTH_ID}/Call/${callSid}/Recording/`,
  ];
  for (const url of endpoints) {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(`  ${url} → ${res.status}: ${text.substring(0, 300)}`);
    if (res.ok) return { url, status: res.status, body: text };
  }
  return null;
}

async function syncMissingRecordings() {
  // Find calls with call_sid + transcript containing [RECORDING DEBUG] but no recording_url
  const { data } = await voiceSupabase
    .from('call_logs')
    .select('id, call_sid, recording_url, to_phone_number, created_at')
    .is('recording_url', null)
    .not('call_sid', 'is', null)
    .ilike('transcript', '%startVobizRecording invoked%')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Found ${data?.length || 0} calls with recording triggered but no URL saved\n`);

  for (const call of (data || [])) {
    console.log(`\nCall ${call.id} (sid: ${call.call_sid}, to: ${call.to_phone_number})`);
    const result = await fetchRecordingForSid(call.call_sid);
    if (result) {
      try {
        const parsed = JSON.parse(result.body);
        // Look for recording URL in response
        const recordingUrl = parsed?.objects?.[0]?.record_url 
          || parsed?.record_url 
          || parsed?.recording_url
          || parsed?.url;
        if (recordingUrl) {
          console.log(`  ✅ Found recording URL: ${recordingUrl}`);
          // Update DB
          const { error } = await voiceSupabase
            .from('call_logs')
            .update({ recording_url: recordingUrl })
            .eq('id', call.id);
          if (error) console.error('  DB update error:', error);
          else console.log('  ✅ Updated in DB!');
        } else {
          console.log('  Response found but no URL in it:', result.body.substring(0, 200));
        }
      } catch(e) {
        console.log('  Could not parse response:', result.body.substring(0, 200));
      }
    }
  }
}

syncMissingRecordings();
