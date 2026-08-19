const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const orgId = 'f452203e-c1b4-49c9-87c7-2b7d7a4ce2e2';
  const { data: settings, error } = await supabase
    .from('organization_settings')
    .select('gemini_api_key, whatsapp_token, whatsapp_phone_id')
    .eq('org_id', orgId)
    .single();
    
  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }
  
  console.log('Settings for org', orgId);
  console.log('Has Gemini Key?', !!settings.gemini_api_key);
  console.log('Has WhatsApp Token?', !!settings.whatsapp_token);
  console.log('Has WhatsApp Phone ID?', !!settings.whatsapp_phone_id);
}
run();
