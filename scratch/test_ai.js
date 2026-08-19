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
    
  // Try gemini-flash-lite-latest
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${settings.gemini_api_key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
    })
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Body:', text.substring(0, 300));
}
run();
