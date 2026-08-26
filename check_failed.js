const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabaseAdmin.from('messages')
    .select('message')
    .ilike('message', '%131053%')
    .limit(1);
  console.log(data[0].message);
}
check();
