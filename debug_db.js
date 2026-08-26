const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: msgs, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('phone_number', '918295149273')
    .order('timestamp', { ascending: false })
    .limit(5);
    
  console.log("MESSAGES:", JSON.stringify(msgs, null, 2));

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('phone_number', '918295149273')
    .single();

  console.log("CONV:", JSON.stringify(conv, null, 2));
}

check();
