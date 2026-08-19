const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const phone = '918708551637';
  const org = 'f452203e-c1b4-49c9-87c7-2b7d7a4ce2e2';
  
  const { data } = await supabase
    .from('conversations')
    .select('id, phone_number, ai_mode')
    .eq('phone_number', phone)
    .eq('org_id', org)
    .single();
    
  console.log('Conversation:', data);
}
run();
