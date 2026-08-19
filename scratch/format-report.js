const { Client } = require('pg');
const fs = require('fs');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';
const WORKFLOW_ID = 'jh1MFHmcziQN6OYv';
const REPORT_PATH = '/Users/trimanjotsingh/.gemini/antigravity/brain/0aa4b1e7-40f5-478e-8e45-3a0fe713441b/extracted_leads_report.md';

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

async function generateReport() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
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

    const res = await client.query(query, [WORKFLOW_ID]);
    const extracted = [];

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

      const nodeNames = Object.keys(runData);
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

      if (leadPayload && leadPayload.body && leadPayload.body.data) {
        const d = leadPayload.body.data;
        extracted.push({
          execution_id: row.execution_id,
          stopped_at_ist: new Date(stoppedAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
          name: d.name || 'N/A',
          phone: d.from || 'N/A',
          message: d.body || 'N/A'
        });
      }
    }

    // Generate Markdown
    let md = `# Extracted Failed Leads Report\n\n`;
    md += `**Timeframe (IST):** Aug 7, 2026 10:54 AM to Aug 8, 2026 12:13 PM\n`;
    md += `**Organization:** Nelson Business School\n`;
    md += `**Total Leads Extracted:** ${extracted.length}\n\n`;
    
    md += `| Execution ID | Timestamp (IST) | Name | Phone Number | Message |\n`;
    md += `|--------------|-----------------|------|--------------|---------|\n`;
    
    for (const item of extracted) {
      const cleanMsg = item.message.replace(/\r?\n|\r/g, ' ');
      md += `| ${item.execution_id} | ${item.stopped_at_ist} | ${item.name} | ${item.phone} | ${cleanMsg} |\n`;
    }

    fs.writeFileSync(REPORT_PATH, md);
    console.log(`Report generated successfully at: ${REPORT_PATH}`);
    console.log(`Total count: ${extracted.length}`);

  } catch (e) {
    console.error('Error generating report:', e);
  } finally {
    await client.end();
  }
}

generateReport();
