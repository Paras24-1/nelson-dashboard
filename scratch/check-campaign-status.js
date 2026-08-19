const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function checkCampaignStatuses() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Check the trigger workflow code for campaign status check
    const res = await client.query(
      "SELECT id, name, nodes FROM workflow_entity WHERE id = 'yP8cE59W0r3HEIMo';"
    );
    
    if (res.rows.length > 0) {
      const row = res.rows[0];
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes;
      console.log(`Workflow: ${row.name}`);
      nodes.forEach(n => {
        const nodeStr = JSON.stringify(n);
        if (nodeStr.toLowerCase().includes('status') || nodeStr.toLowerCase().includes('running') || nodeStr.toLowerCase().includes('campaign')) {
          console.log(`\nNode: ${n.name}`);
          console.log(JSON.stringify(n.parameters, null, 2));
        }
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

checkCampaignStatuses();
