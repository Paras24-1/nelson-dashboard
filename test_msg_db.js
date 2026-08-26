const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.from('messages')
    .select('id, message, direction, status, created_at, media_url, media_type, platform')
    .eq('phone_number', '918384837772')
    .order('created_at', { ascending: true })
    .limit(10);
  console.log("MESSAGES FOR 918384837772:", JSON.stringify(data, null, 2));
}
check();
