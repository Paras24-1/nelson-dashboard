const { Client } = require('pg');

const n8nDbUrl = 'postgresql://postgres:IDdqSBCywIgfRThWJSNaRGaETfVDdlhW@switchyard.proxy.rlwy.net:33933/railway';

async function inspectExecutions() {
  const client = new Client({
    connectionString: n8nDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to n8n database.');

    // 1. Check total rows in execution_entity
    const countRes = await client.query('SELECT COUNT(*) FROM execution_entity;');
    console.log('Total executions in database:', countRes.rows[0].count);

    // 2. Check counts by status
    const statusRes = await client.query('SELECT status, COUNT(*) FROM execution_entity GROUP BY status;');
    console.log('Executions by status:', statusRes.rows);

    // 3. Get latest 5 executions (any status)
    const latestRes = await client.query(`
      SELECT id, status, "startedAt", "stoppedAt", "workflowId" 
      FROM execution_entity 
      ORDER BY "startedAt" DESC 
      LIMIT 5;
    `);
    console.log('Latest 5 executions in n8n:', latestRes.rows);

    // 4. Get latest 5 failed executions
    const failedRes = await client.query(`
      SELECT id, status, "startedAt", "stoppedAt", "workflowId" 
      FROM execution_entity 
      WHERE status = 'failed'
      ORDER BY "startedAt" DESC 
      LIMIT 5;
    `);
    console.log('Latest 5 failed executions in n8n:', failedRes.rows);

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

inspectExecutions();
