const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: org } = await supabaseAdmin.from('organizations').select('id, name').ilike('slug', '%iwebmagic%').single();
  
  if (org) {
     const payload = {
        phone_number: '918360599157',
        name: 'Test Lead',
        duration: 120,
        status: 'completed',
        summary: 'Customer wants a restaurant website',
        industry: 'Restaurant',
        org_id: org.id
     };
     
     const res = await fetch('http://localhost:3000/api/webhook/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
     });
     
     console.log("LOCAL RESPONSE:", await res.text());
  }
}
test();
