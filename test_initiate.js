const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: org } = await supabaseAdmin.from('organizations').select('id, name').ilike('slug', '%iwebmagic%').single();
  
  if (org) {
     console.log("Sending Initiate Webhook...");
     const payload = {
       phone: '918360599157',
       name: 'Paras Kataria',
       template_name: 'call_connect2',
       template_lang: 'en',
       variables: ['Paras Kataria', 'https://iwebmagics.com/portfolio'],
       message_text: `Test message`,
       org_id: org.id
     };
     
     const res = await fetch('https://voxaiagents.com/api/conversations/initiate', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-internal-secret': 'internal-ai-reply' 
        },
        body: JSON.stringify(payload)
     });
     
     console.log("RESPONSE:", await res.text());
  }
}
test();
