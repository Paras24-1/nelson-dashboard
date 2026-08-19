const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// ⚡️ Connection string to your Railway n8n database
const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

// ⚡️ Supabase settings
const supabaseUrl = 'https://jncmizoejeaclpnfxazg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY21pem9lamVhY2xwbmZ4YXpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMTczMiwiZXhwIjoyMDkyNzA3NzMyfQ.A8A4tMGzUFuhH4DOSb77QByuKmNdajZ_kCRvr_yxqFo';
const supabase = createClient(supabaseUrl, supabaseKey);

// Fallback slug
const DEFAULT_ORG_SLUG = 'curiocrafts';

// Recursive TypeORM/n8n Flatted array un-flattener
function unflatten(data) {
  if (!Array.isArray(data)) return data;
  const resolved = new Map();
  function resolve(val) {
    if (typeof val === 'string' && /^\d+$/.test(val)) {
      const idx = parseInt(val, 10);
      if (idx >= 0 && idx < data.length) {
        if (resolved.has(idx)) return resolved.get(idx);
        const placeholder = {};
        resolved.set(idx, placeholder);
        const original = data[idx];
        if (Array.isArray(original)) {
          const arr = original.map(resolve);
          resolved.set(idx, arr);
          return arr;
        } else if (original && typeof original === 'object') {
          for (const key of Object.keys(original)) {
            placeholder[key] = resolve(original[key]);
          }
          return placeholder;
        } else {
          resolved.set(idx, original);
          return original;
        }
      }
    }
    return val;
  }
  return resolve('0');
}

async function runRecovery() {
  console.log('Connecting to n8n Postgres database on Railway...');
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Keep a cache of slug -> orgId to avoid excessive Supabase queries
  const orgCache = new Map();

  try {
    await client.connect();
    console.log('Connected to n8n database successfully.');

    // Fetch error runs from yesterday 12:30 PM (IST) onwards
    const query = `
      SELECT 
        ee.id AS execution_id,
        ed.data AS execution_data,
        ee."stoppedAt" AS stopped_at
      FROM execution_data ed
      JOIN execution_entity ee ON ed."executionId" = ee.id
      WHERE ee.status = 'error'
        AND ee."stoppedAt" >= '2026-07-12T07:00:00Z'
      ORDER BY ee.id ASC;
    `;

    console.log('Querying failed executions from July 12, 12:45 PM IST onwards...');
    const result = await client.query(query);
    console.log(`Found ${result.rows.length} total failed executions in n8n.`);

    let recoveredCount = 0;
    let skipCount = 0;

    for (const row of result.rows) {
      const stoppedAt = row.stopped_at;
      let rawData;
      try {
        rawData = typeof row.execution_data === 'string' ? JSON.parse(row.execution_data) : row.execution_data;
      } catch (e) {
        continue;
      }

      // Unflatten the TypeORM array representation
      const cleanData = unflatten(rawData);
      const runData = cleanData?.resultData?.runData || {};

      // Scan target HTTP request nodes that forward logs to the dashboard
      const nodeNames = ['HTTP Request', 'HTTP Request1', 'Send WhatsApp1'];
      const itemsToProcess = [];

      for (const nodeName of nodeNames) {
        const nodeRuns = runData[nodeName] || [];
        for (const execution of nodeRuns) {
          // Find runs that failed during their HTTP request phase
          if (execution && execution.executionStatus === 'error' && execution.error?.context?.request) {
              const req = execution.error.context.request;
              const body = req.body;
              const uri = req.uri || req.url;

              if (body && typeof body === 'object') {
                // Parse org slug from URI (e.g. ?org=nelson-business-school- or ?org=curiocrafts)
                let orgSlug = DEFAULT_ORG_SLUG;
                try {
                  const urlObj = new URL(uri);
                  orgSlug = urlObj.searchParams.get('org') || DEFAULT_ORG_SLUG;
                } catch (e) {
                  // Fallback
                }

                itemsToProcess.push({
                  phone: body.phone_number || body.contact_phone || (body.payload && body.payload.to),
                  name: body.name || body.contact_name,
                  message: body.message || (body.payload && body.payload.template && body.payload.template.name) || 'History Synced',
                  direction: body.direction || (body.payload && body.payload.to ? 'outgoing' : 'incoming'),
                  mediaUrl: body.media_url || null,
                  mediaType: body.media_type || null,
                  orgSlug: orgSlug,
                  campaignId: body.campaign_id || null
                });
              }
            }
          }
        }

      for (const item of itemsToProcess) {
        const phone = String(item.phone || '').replace(/\D/g, '');
        if (!phone) continue;

        // Resolve orgId
        let orgId = orgCache.get(item.orgSlug);
        if (!orgId) {
          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', item.orgSlug)
            .maybeSingle();
          if (org?.id) {
            orgId = org.id;
            orgCache.set(item.orgSlug, orgId);
          } else {
            // Fallback to default
            orgId = orgCache.get(DEFAULT_ORG_SLUG);
            if (!orgId) {
              const { data: defaultOrg } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', DEFAULT_ORG_SLUG)
                .maybeSingle();
              orgId = defaultOrg?.id;
              if (orgId) orgCache.set(DEFAULT_ORG_SLUG, orgId);
            }
          }
        }

        if (!orgId) {
          console.warn(`Skipping message for ${phone}: Could not resolve organization ID for slug: ${item.orgSlug}`);
          continue;
        }

        // If it's a campaign message, let's try to get the actual template body text if we have the campaign details
        let msgText = item.message;
        if (item.campaignId) {
          const { data: campaign } = await supabase
            .from('campaigns')
            .select('template_body')
            .eq('id', item.campaignId)
            .maybeSingle();
          if (campaign?.template_body) {
            msgText = campaign.template_body;
          }
        }

        // 1. Upsert Conversation
        const { data: conv, error: convError } = await supabase
          .from('conversations')
          .upsert({
            phone_number: phone,
            name: item.name || phone,
            last_message: msgText,
            org_id: orgId,
            updated_at: stoppedAt,
            platform: 'whatsapp'
          }, { onConflict: 'phone_number,org_id' })
          .select()
          .single();

        if (convError) {
          console.error(`Failed to upsert conversation for ${phone}:`, convError.message);
          continue;
        }

        // 2. Insert Message
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conv.id,
            org_id: orgId,
            phone_number: phone,
            message: msgText,
            direction: item.direction,
            timestamp: stoppedAt,
            platform: 'whatsapp',
            media_url: item.mediaUrl || null,
            media_type: item.mediaType || null
          });

        if (msgError) {
          console.error(`Failed to insert message for ${phone}:`, msgError.message);
          continue;
        }

        recoveredCount++;
      }
    }

    console.log(`\n🎉 Success! Recovered a total of ${recoveredCount} missing chat logs in the dashboard!`);

  } catch (err) {
    console.error('Error during recovery process:', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

runRecovery();
