const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jncmizoejeaclpnfxazg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY21pem9lamVhY2xwbmZ4YXpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMTczMiwiZXhwIjoyMDkyNzA3NzMyfQ.A8A4tMGzUFuhH4DOSb77QByuKmNdajZ_kCRvr_yxqFo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importPayloads() {
  const filePath = 'failed_payloads.json';
  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found. Please place the exported file in the root directory.`);
    return;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      const payload = data.payload;
      const stoppedAt = data.stopped_at;

      // Extract details
      const phone = payload.contact_phone;
      const name = payload.contact_name;
      const campaignId = payload.campaign_id;
      
      if (!phone || !campaignId) continue;

      // Get org_id and template details from the campaign
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('org_id, template_body')
        .eq('id', campaignId)
        .maybeSingle();
        
      const orgId = campaign?.org_id;
      if (!orgId) {
        console.warn(`Skipping contact ${phone}: Campaign ${campaignId} not found in database.`);
        continue;
      }

      const msgText = campaign?.template_body || 'Template message sent';

      // 1. Upsert conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .upsert({
          phone_number: phone,
          name: name || phone,
          last_message: msgText,
          org_id: orgId,
          updated_at: stoppedAt,
          platform: 'whatsapp'
        }, { onConflict: 'phone_number,org_id' })
        .select()
        .single();

      if (convError) throw convError;

      // 2. Insert message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          org_id: orgId,
          phone_number: phone,
          message: msgText,
          direction: 'outgoing',
          timestamp: stoppedAt,
          platform: 'whatsapp'
        });

      if (msgError) throw msgError;

      count++;
    } catch (err) {
      console.error('Error processing record:', err.message);
    }
  }
  console.log(`Successfully recovered ${count} missing messages in the dashboard!`);
}

importPayloads();
