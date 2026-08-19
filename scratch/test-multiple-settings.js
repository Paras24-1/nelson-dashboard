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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('org_id', '6b8e71d1-8e94-42ec-bb2b-57c20cd6f2c6');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Found ${data.length} records for org_id 6b8e71d1-8e94-42ec-bb2b-57c20cd6f2c6:`);
  data.forEach((d, idx) => {
    console.log(`Record #${idx + 1}:`, {
      id: d.id,
      waba_id: d.whatsapp_waba_id,
      phone_id: d.whatsapp_phone_id,
      token_preview: d.whatsapp_token ? d.whatsapp_token.substring(0, 15) + '...' : 'null'
    });
  });
}
run();
