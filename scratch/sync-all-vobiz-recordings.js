const AUTH_ID = 'MA_937EKWJ9';
const AUTH_TOKEN = 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh';
const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);
const headers = { 'X-Auth-ID': AUTH_ID, 'X-Auth-Token': AUTH_TOKEN };

async function fetchAllVobizRecordings() {
  let all = [], offset = 0, limit = 20;
  while (true) {
    const res = await fetch(`https://api.vobiz.ai/api/v1/Account/${AUTH_ID}/Recording/?limit=${limit}&offset=${offset}`, { headers });
    const data = await res.json();
    const objects = data?.objects || [];
    all = all.concat(objects);
    if (objects.length < limit) break;
    offset += limit;
  }
  return all;
}

async function fetchAllCallLogsWithNoRecording() {
  let all = [], from = 0, pageSize = 1000;
  while (true) {
    const { data, error } = await voiceSupabase
      .from('call_logs')
      .select('id, call_sid, recording_url')
      .is('recording_url', null)
      .not('call_sid', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) { console.error('DB error:', error); break; }
    all = all.concat(data || []);
    console.log(`  Fetched page ${from/pageSize + 1}: ${data?.length} rows (total: ${all.length})`);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function syncAllRecordings() {
  console.log('Fetching all recordings from Vobiz...');
  const recordings = await fetchAllVobizRecordings();
  const uuidToUrl = {};
  for (const r of recordings) {
    if (r.call_uuid && r.recording_url) uuidToUrl[r.call_uuid] = r.recording_url;
  }
  console.log(`✅ Vobiz recordings loaded: ${Object.keys(uuidToUrl).length}`);
  console.log('Sample Vobiz call_uuids:', Object.keys(uuidToUrl).slice(0, 3));

  console.log('\nFetching all DB call logs with no recording_url...');
  const callLogs = await fetchAllCallLogsWithNoRecording();
  console.log(`✅ DB call logs (no recording): ${callLogs.length}`);
  console.log('Sample DB call_sids:', callLogs.slice(0, 3).map(l => l.call_sid));

  let updated = 0, notFound = 0;
  for (const log of callLogs) {
    const recordingUrl = uuidToUrl[log.call_sid];
    if (recordingUrl) {
      const { error } = await voiceSupabase
        .from('call_logs')
        .update({ recording_url: recordingUrl })
        .eq('id', log.id);
      if (error) console.error(`  ❌ ${log.id}:`, error.message);
      else { console.log(`  ✅ ${log.id} → ${recordingUrl.split('/').pop()}`); updated++; }
    } else {
      notFound++;
    }
  }

  console.log(`\n=== DONE: ${updated} updated, ${notFound} genuinely no recording ===`);
}

syncAllRecordings();
