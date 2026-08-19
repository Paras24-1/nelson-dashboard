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
  
  console.log('Checking organization_settings columns...');
  
  const { data, error } = await supabase
    .from('organization_settings')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error querying organization_settings:', error);
  } else {
    console.log('✅ Connected successfully!');
    if (data.length === 0) {
      console.log('No settings rows exist yet, but let\'s check column keys returned:');
    } else {
      console.log('Columns found in organization_settings row:', Object.keys(data[0]));
    }
  }
}

run();
