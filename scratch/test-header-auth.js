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

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('whatsapp_token, whatsapp_phone_id, whatsapp_waba_id')
    .eq('org_id', orgId)
    .single();

  const token = settings.whatsapp_token;
  const wabaId = settings.whatsapp_waba_id;

  console.log(`Testing Header Auth for WABA ${wabaId}...`);
  
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates?status=APPROVED&limit=5`,
    {
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await res.json();
  console.log('Result with Authorization Header:');
  console.log(JSON.stringify(data, null, 2));
}

run();
