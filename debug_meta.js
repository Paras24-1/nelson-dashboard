const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
  const { data: conv } = await supabaseAdmin.from('conversations')
    .select('*')
    .eq('phone_number', '919518670594')
    .single();
  
  console.log("Conversation:", conv);

  const { data: msgs } = await supabaseAdmin.from('messages')
    .select('id, message, created_at, direction')
    .eq('phone_number', '919518670594')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log("Recent msgs:", msgs);
}
debug();
