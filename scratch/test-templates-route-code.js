const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Find Shyama Shop org id
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', '%shyama%');
    
  const orgId = orgs[0].id;
  console.log('Testing for Org ID:', orgId);

  // Exact code from /api/templates/route.ts:
  // Fetch tenant-specific credentials
  const { data: settings, error: settingsError } = await supabase
    .from('organization_settings')
    .select('whatsapp_token, whatsapp_phone_id')
    .eq('org_id', orgId)
    .single()

  console.log('Step 1 (select whatsapp_token, whatsapp_phone_id):');
  console.log('  settingsError:', settingsError);
  console.log('  has token:', !!settings?.whatsapp_token);
  console.log('  phone_id:', settings?.whatsapp_phone_id);

  let wabaId = ''
  try {
    const { data: wabaSetting, error: wabaErr } = await supabase
      .from('organization_settings')
      .select('whatsapp_waba_id')
      .eq('org_id', orgId)
      .maybeSingle()
    
    console.log('Step 2 (select whatsapp_waba_id):');
    console.log('  wabaErr:', wabaErr);
    console.log('  wabaSetting:', wabaSetting);
    wabaId = wabaSetting?.whatsapp_waba_id || ''
  } catch (e) {
    console.log('[templates] whatsapp_waba_id column may not exist in organization_settings table:', e)
  }

  console.log('Resolved WABA ID:', wabaId ? `"${wabaId}"` : 'EMPTY');

  if (!wabaId) {
    console.log('Running auto-discovery because WABA ID is empty!');
  } else {
    console.log('Fetching templates using direct WABA ID query...');
    const templatesRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?status=APPROVED&limit=5`,
      {
        headers: { Authorization: `Bearer ${settings.whatsapp_token}` }
      }
    )
    const templatesData = await templatesRes.json()
    console.log('Templates fetch result (direct):');
    console.log(JSON.stringify(templatesData, null, 2));
  }
}

run();
