const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function inspectVoiceWorkflow() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Query workflows relating to voice
    const res = await client.query(
      "SELECT id, name, nodes FROM workflow_entity WHERE name ILIKE '%voice%' OR name ILIKE '%dialer%' OR id = 'yP8cE59W0r3HEIMo';"
    );
    
    for (const row of res.rows) {
      console.log(`\n=== Workflow: ${row.name} (${row.id}) ===`);
      const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes;
      
      // Look for HTTP Request nodes containing our trigger domain
      const httpNodes = nodes.filter(n => 
        n.type === 'n8n-nodes-base.httpRequest' || 
        JSON.stringify(n).includes('voice-aura')
      );
      
      console.log(`Found ${httpNodes.length} relevant nodes:`);
      httpNodes.forEach(node => {
        console.log(JSON.stringify(node, null, 2));
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

inspectVoiceWorkflow();
