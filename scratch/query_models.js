const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const orgId = 'f452203e-c1b4-49c9-87c7-2b7d7a4ce2e2';
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('gemini_api_key')
    .eq('org_id', orgId)
    .single();
    
  if (!settings || !settings.gemini_api_key) return console.log('No key');
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${settings.gemini_api_key}`);
  const data = await res.json();
  console.log(data.models?.map(m => m.name).join('\n') || data);
}
run();
