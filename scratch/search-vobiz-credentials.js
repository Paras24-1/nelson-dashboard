const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function searchCredentials() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query("SELECT id, name, nodes FROM workflow_entity;");
    
    console.log('Searching nodes for Vobiz auth patterns...');
    for (const row of res.rows) {
      const nodesStr = typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes);
      
      if (nodesStr.toLowerCase().includes('auth-id') || 
          nodesStr.toLowerCase().includes('auth-token') || 
          nodesStr.toLowerCase().includes('vobiz') ||
          nodesStr.toLowerCase().includes('media.vobiz.ai')) {
        console.log(`\nMatch found in Workflow: ${row.name} (${row.id})`);
        
        const nodes = JSON.parse(nodesStr);
        nodes.forEach(n => {
          const nodeJson = JSON.stringify(n);
          if (nodeJson.toLowerCase().includes('auth') || nodeJson.toLowerCase().includes('vobiz')) {
            console.log(`Node Name: ${n.name}`);
            console.log(JSON.stringify(n, null, 2));
          }
        });
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

searchCredentials();
