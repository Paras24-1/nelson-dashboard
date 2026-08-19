const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function inspectTranscripts() {
  // Find recent calls with call_sid and check their transcripts for recording debug info
  const { data } = await voiceSupabase
    .from('call_logs')
    .select('id, call_sid, recording_url, transcript, to_phone_number, created_at')
    .not('call_sid', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  for (const call of (data || [])) {
    console.log(`\n=== Call ${call.id} (to: ${call.to_phone_number}) ===`);
    console.log(`  call_sid: ${call.call_sid}`);
    console.log(`  recording_url: ${call.recording_url || 'NULL'}`);
    // Show just the recording debug section of the transcript
    const transcript = call.transcript || '';
    const debugIdx = transcript.indexOf('[RECORDING DEBUG]');
    if (debugIdx !== -1) {
      console.log(`  RECORDING DEBUG found:`);
      console.log(transcript.substring(debugIdx, debugIdx + 400));
    } else {
      console.log(`  NO recording debug in transcript`);
      // Show last 200 chars of transcript
      console.log(`  Transcript tail: ${transcript.substring(Math.max(0, transcript.length - 200))}`);
    }
  }
}

inspectTranscripts();
