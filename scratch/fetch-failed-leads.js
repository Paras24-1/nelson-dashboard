const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';
const WORKFLOW_ID = 'jh1MFHmcziQN6OYv';

// Unflatten TypeORM flatted array representation
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

async function fetchFailedData() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Time boundaries (UTC):
    // 7 Aug 10:54 AM IST = 2026-08-07T05:24:00Z
    // 8 Aug 12:13 PM IST = 2026-08-08T06:43:00Z
    const query = `
      SELECT 
        ee.id AS execution_id,
        ed.data AS execution_data,
        ee."stoppedAt" AS stopped_at
      FROM execution_data ed
      JOIN execution_entity ee ON ed."executionId" = ee.id
      WHERE ee."workflowId" = $1
        AND ee.status = 'error'
        AND ee."stoppedAt" >= '2026-08-07T05:24:00Z'
        AND ee."stoppedAt" <= '2026-08-08T06:43:00Z'
      ORDER BY ee.id ASC;
    `;

    console.log(`Querying executions for workflow ${WORKFLOW_ID} stopped between Aug 7, 10:54 AM and Aug 8, 12:13 PM IST...`);
    const res = await client.query(query, [WORKFLOW_ID]);
    console.log(`Found ${res.rows.length} executions with status 'error'.\n`);

    const extractedLeads = [];

    for (const row of res.rows) {
      let rawData;
      try {
        rawData = typeof row.execution_data === 'string' ? JSON.parse(row.execution_data) : row.execution_data;
      } catch (err) {
        continue;
      }

      const cleanData = unflatten(rawData);
      const runData = cleanData?.resultData?.runData || {};
      const stoppedAt = row.stopped_at;

      // Print node names present in this execution
      const nodeNames = Object.keys(runData);

      // Check different potential trigger nodes
      // In n8n, trigger output is usually found inside the first node run list:
      // runData[triggerNodeName][0].data.main[0][0].json
      let leadPayload = null;

      for (const nodeName of nodeNames) {
        if (nodeName.toLowerCase().includes('trigger') || nodeName.toLowerCase().includes('webhook')) {
          const nodeRuns = runData[nodeName] || [];
          if (nodeRuns.length > 0 && nodeRuns[0].data && nodeRuns[0].data.main && nodeRuns[0].data.main[0]) {
            const mainData = nodeRuns[0].data.main[0];
            if (mainData.length > 0 && mainData[0].json) {
              leadPayload = mainData[0].json;
            }
          }
        }
      }

      if (leadPayload) {
        extractedLeads.push({
          execution_id: row.execution_id,
          stopped_at: stoppedAt,
          stopped_at_ist: new Date(stoppedAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
          payload: leadPayload
        });
      } else {
        // Fallback: print execution nodes if no payload found
        console.log(`Execution ID ${row.execution_id} parsed, but no trigger node payload found. Node keys:`, nodeNames);
      }
    }

    console.log('--- EXTRACTED LEADS REPORT ---');
    console.log(JSON.stringify(extractedLeads, null, 2));
    console.log(`\nTotal leads successfully extracted: ${extractedLeads.length}`);

  } catch (e) {
    console.error('Error fetching failed data:', e);
  } finally {
    await client.end();
  }
}

fetchFailedData();
