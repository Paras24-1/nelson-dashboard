const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabaseAdmin.from('messages')
    .select('*')
    .eq('phone_number', '918360599157')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log("MESSAGES:", JSON.stringify(data, null, 2));
}
check();
