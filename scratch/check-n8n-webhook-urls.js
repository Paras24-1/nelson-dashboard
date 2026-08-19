const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function getWebhookUrls() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Get column names for webhook_entity first
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'webhook_entity'
    `);
    console.log('webhook_entity columns:', cols.rows.map(r => r.column_name));
    
    // Get all webhook rows
    const res = await client.query(`SELECT * FROM webhook_entity LIMIT 20`);
    console.log('\nAll webhooks:');
    res.rows.forEach(r => console.log(JSON.stringify(r)));
    
    // Also get n8n base URL from settings
    const settings = await client.query(`SELECT * FROM settings`);
    console.log('\nn8n settings:');
    settings.rows.forEach(r => console.log(JSON.stringify(r)));
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

getWebhookUrls();
