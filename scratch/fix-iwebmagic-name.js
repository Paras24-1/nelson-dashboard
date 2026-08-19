const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function fixIwebmagicName() {
  // First check how many rows have 'iwebmagic' in from_phone_number
  const { count: fromCount } = await voiceSupabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('from_phone_number', 'iwebmagic');

  // Also check to_phone_number
  const { count: toCount } = await voiceSupabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('to_phone_number', 'iwebmagic');

  console.log(`Found ${fromCount} rows with from_phone_number = 'iwebmagic'`);
  console.log(`Found ${toCount} rows with to_phone_number = 'iwebmagic'`);

  // Update from_phone_number
  const { error: err1, count: updated1 } = await voiceSupabase
    .from('call_logs')
    .update({ from_phone_number: 'iwebmagics' })
    .eq('from_phone_number', 'iwebmagic');

  if (err1) console.error('Error updating from_phone_number:', err1);
  else console.log(`✅ Updated from_phone_number: ${updated1 ?? fromCount} rows`);

  // Update to_phone_number
  const { error: err2, count: updated2 } = await voiceSupabase
    .from('call_logs')
    .update({ to_phone_number: 'iwebmagics' })
    .eq('to_phone_number', 'iwebmagic');

  if (err2) console.error('Error updating to_phone_number:', err2);
  else console.log(`✅ Updated to_phone_number: ${updated2 ?? toCount} rows`);

  console.log('\nDone! All iwebmagic → iwebmagics');
}

fixIwebmagicName();
