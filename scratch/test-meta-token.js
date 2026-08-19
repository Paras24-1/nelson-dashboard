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
  
  console.log('Retrieving curiocrafts credentials...');
  
  // Find curiocrafts org id
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', 'curiocrafts')
    .single();
    
  if (orgError || !org) {
    console.error('Could not find organization curiocrafts:', orgError);
    return;
  }
  
  const { data: settings, error: settingsError } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('org_id', org.id)
    .single();
    
  if (settingsError || !settings) {
    console.error('Could not find settings for curiocrafts:', settingsError);
    return;
  }
  
  const token = settings.whatsapp_token;
  const phoneId = settings.whatsapp_phone_id;
  
  if (!token) {
    console.error('No token found for curiocrafts!');
    return;
  }
  
  console.log(`Testing Meta API for token: ${token.substring(0, 15)}...`);
  console.log(`Configured Phone ID: ${phoneId}`);
  
  // Test 1: Get Token Info via /me
  try {
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
    const meData = await meRes.json();
    console.log('\n--- 1. /me details ---');
    console.log(JSON.stringify(meData, null, 2));
  } catch (err) {
    console.error('Error fetching /me:', err);
  }
  
  // Test 2: Get WhatsApp accounts directly via /me/whatsapp_business_accounts
  try {
    const wabaRes = await fetch(`https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${token}`);
    const wabaData = await wabaRes.json();
    console.log('\n--- 2. /me/whatsapp_business_accounts ---');
    console.log(JSON.stringify(wabaData, null, 2));
    
    if (wabaData.data && wabaData.data.length > 0) {
      console.log('\nScanning WABAs for configured phone number ID...');
      for (const waba of wabaData.data) {
        const phoneRes = await fetch(`https://graph.facebook.com/v19.0/${waba.id}/phone_numbers?access_token=${token}`);
        const phoneData = await phoneRes.json();
        console.log(`\nWABA: ${waba.name} (ID: ${waba.id})`);
        console.log(`Phone numbers list:`, JSON.stringify(phoneData.data, null, 2));
        if (phoneData.error) {
          console.error(`Error fetching phone numbers for WABA ${waba.id}:`, phoneData.error);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching /me/whatsapp_business_accounts:', err);
  }
}

run();
