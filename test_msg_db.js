const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: orgData } = await supabaseAdmin.from('organization_settings').select('whatsapp_token, whatsapp_phone_id').eq('org_id', 'c7dc4205-6063-44cc-9ef4-9fb8b1abaa8b').single();
  
  if (orgData) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${orgData.whatsapp_phone_id}`, {
      headers: {
        'Authorization': `Bearer ${orgData.whatsapp_token}`
      }
    });
    const json = await res.json();
    console.log("META API RESULT:", json);
  }
}
check();
