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

const mainUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const mainServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const voiceUrl = env.NEXT_PUBLIC_VOICE_SUPABASE_URL;
const voiceServiceKey = env.VOICE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabaseMain = createClient(mainUrl, mainServiceKey);
  const supabaseVoice = createClient(voiceUrl, voiceServiceKey);

  console.log('Fetching organizations and calling stats...');
  const { data: orgs, error: orgError } = await supabaseMain
    .from('organizations')
    .select('id, name, voice_org_id, voice_wallet_credits');

  if (orgError) {
    console.error('Error fetching main organizations:', orgError);
    return;
  }

  for (const org of orgs) {
    console.log(`\nOrganization: ${org.name} (voice_org_id: ${org.voice_org_id})`);
    console.log(`Wallet Balance: ₹${org.voice_wallet_credits || 0.00}`);

    if (org.voice_org_id) {
      const { data: logs, error: logsError } = await supabaseVoice
        .from('call_logs')
        .select('duration_seconds')
        .eq('organization_id', org.voice_org_id);

      if (logsError) {
        console.error(`  Error fetching call logs for voice_org_id ${org.voice_org_id}:`, logsError);
      } else {
        const totalDurationSeconds = (logs || []).reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
        const totalMinutes = totalDurationSeconds / 60;
        console.log(`  Total Calls Made: ${logs.length}`);
        console.log(`  Total Minutes Used: ${totalMinutes.toFixed(2)} / 100 free minutes`);
        if (totalMinutes > 100) {
          const overage = totalMinutes - 100;
          console.log(`  Overage minutes: ${overage.toFixed(2)} min (Cost: ₹${(overage * 3.5).toFixed(2)})`);
          console.log(`  Expected Remaining Wallet Balance: ₹${((org.voice_wallet_credits || 0) - overage * 3.5).toFixed(2)}`);
        } else {
          console.log(`  Remaining Free Minutes: ${(100 - totalMinutes).toFixed(2)} min`);
        }
      }
    } else {
      console.log('  ❌ Voice service not linked.');
    }
  }
}

run();
