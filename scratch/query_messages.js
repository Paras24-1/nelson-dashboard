const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('--- Fetching Last 10 Messages ---');
  const { data: msgs, error } = await supabase
    .from('messages')
    .select('id, phone_number, message, direction, timestamp, org_id')
    .order('timestamp', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }
  console.log(msgs);
}
run();
