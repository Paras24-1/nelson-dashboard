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
  
  console.log('Retrieving Shyama Shop credentials...');
  
  // Find Shyama Shop org
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('name', '%shyama%');
    
  if (orgError || !orgs || orgs.length === 0) {
    console.error('Could not find organization containing "shyama":', orgError);
    return;
  }
  
  const org = orgs[0];
  console.log(`Found Org: ${org.name} (ID: ${org.id})`);
  
  const { data: settings, error: settingsError } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('org_id', org.id)
    .single();
    
  if (settingsError || !settings) {
    console.error('Could not find settings for Shyama Shop:', settingsError);
    return;
  }
  
  const token = settings.whatsapp_token;
  const phoneId = settings.whatsapp_phone_id;
  const wabaId = settings.whatsapp_waba_id;
  
  if (!token) {
    console.error('No token found for Shyama Shop!');
    return;
  }
  
  console.log(`Testing Meta API for Shyama Shop Token: ${token.substring(0, 15)}...`);
  console.log(`Configured Phone ID: ${phoneId}`);
  console.log(`Configured WABA ID: ${wabaId}`);
  
  // Test 1: Get Token Info via /me
  try {
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
    const meData = await meRes.json();
    console.log('\n--- 1. Meta /me details ---');
    console.log(JSON.stringify(meData, null, 2));
  } catch (err) {
    console.error('Error fetching /me:', err);
  }
  
  // Test 2: Try to directly query the templates edge
  try {
    const templatesRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?status=APPROVED&limit=5&access_token=${token}`
    );
    const templatesData = await templatesRes.json();
    console.log('\n--- 2. Templates Query Result ---');
    console.log(JSON.stringify(templatesData, null, 2));
  } catch (err) {
    console.error('Error querying templates:', err);
  }

  // Test 3: Get accounts directly via /me/whatsapp_business_accounts
  try {
    const wabaRes = await fetch(`https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${token}`);
    const wabaData = await wabaRes.json();
    console.log('\n--- 3. /me/whatsapp_business_accounts ---');
    console.log(JSON.stringify(wabaData, null, 2));
  } catch (err) {
    console.error('Error fetching /me/whatsapp_business_accounts:', err);
  }
}

run();
