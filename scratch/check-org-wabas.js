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
  
  console.log('Querying organizations & settings...');
  
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name');
    
  if (orgError) {
    console.error('Error fetching orgs:', orgError);
    return;
  }
  
  const { data: settings, error: settingsError } = await supabase
    .from('organization_settings')
    .select('org_id, whatsapp_phone_id, whatsapp_waba_id, whatsapp_token');
    
  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return;
  }
  
  const orgMap = {};
  orgs.forEach(o => { orgMap[o.id] = o.name; });
  
  const formatted = settings.map(s => ({
    organization: orgMap[s.org_id] || 'Unknown',
    phone_id: s.whatsapp_phone_id ? `${s.whatsapp_phone_id.substring(0, 5)}...` : 'empty',
    waba_id: s.whatsapp_waba_id || 'empty',
    has_token: s.whatsapp_token ? 'YES' : 'NO',
    token_preview: s.whatsapp_token ? `${s.whatsapp_token.substring(0, 10)}...` : 'empty'
  }));
  
  console.table(formatted);
}

run();
