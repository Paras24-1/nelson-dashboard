const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function dumpVoiceWorkflow() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT id, name, nodes FROM workflow_entity WHERE id = 'LQKSz9mvjITCQAKr';"
    );
    
    if (res.rows.length > 0) {
      const row = res.rows[0];
      console.log(`=== Dump nodes of workflow: ${row.name} ===`);
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes;
      
      nodes.forEach(n => {
        console.log(`\nNode: ${n.name} (${n.type})`);
        console.log(JSON.stringify(n.parameters, null, 2));
      });
    } else {
      console.log('Workflow not found');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

dumpVoiceWorkflow();
