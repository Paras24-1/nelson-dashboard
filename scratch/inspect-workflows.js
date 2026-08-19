const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function listWorkflows() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, name, active FROM workflow_entity;');
    console.log('Workflows list:');
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

listWorkflows();
