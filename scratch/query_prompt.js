const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const orgId = 'f452203e-c1b4-49c9-87c7-2b7d7a4ce2e2';
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('ai_system_prompt')
    .eq('org_id', orgId)
    .single();
    
  console.log('--- SYSTEM PROMPT ---');
  console.log(settings.ai_system_prompt);
}
run();
