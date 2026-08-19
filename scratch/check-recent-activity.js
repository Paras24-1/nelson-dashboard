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
  
  console.log('Fetching recent active conversations...');
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, org_id, updated_at, name')
    .order('updated_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching conversations:', error);
    return;
  }
  
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name');
    
  const orgMap = {};
  orgs.forEach(o => { orgMap[o.id] = o.name; });
  
  const formatted = convs.map(c => ({
    name: c.name,
    organization: orgMap[c.org_id] || 'Unknown',
    updated_at: c.updated_at
  }));
  
  console.table(formatted);
}

run();
