const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

// Unflatten TypeORM flatted array
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

async function inspect() {
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
      WHERE ee.status = 'error'
        AND ee."stoppedAt" >= '2026-08-07T05:24:00Z'
      LIMIT 1;
    `;
    const res = await client.query(query);
    if (res.rows.length === 0) {
      console.log('No failed executions found.');
      return;
    }

    const row = res.rows[0];
    const rawData = typeof row.execution_data === 'string' ? JSON.parse(row.execution_data) : row.execution_data;
    const cleanData = unflatten(rawData);
    
    console.log('--- ROOT KEYS ---');
    console.log(Object.keys(cleanData));
    
    console.log('--- resultData KEYS ---');
    if (cleanData.resultData) {
      console.log(Object.keys(cleanData.resultData));
      if (cleanData.resultData.runData) {
        console.log('--- runData KEYS ---');
        console.log(Object.keys(cleanData.resultData.runData));
        
        const triggerData = cleanData.resultData.runData['Google Sheets Trigger'];
        console.log('--- Google Sheets Trigger Data ---');
        console.log(JSON.stringify(triggerData, null, 2));
      }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

inspect();
