const { createClient } = require('@supabase/supabase-js');

const voiceUrl = 'https://ujioydnrqbltdgteeclf.supabase.co';
const voiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95ZG5ycWJsdGRndGVlY2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDExMCwiZXhwIjoyMDk2MDU2MTEwfQ.NC84esABLXOXeW-p9duQsabHnR1FVg3BIrR8emRJrUc';
const voiceSupabase = createClient(voiceUrl, voiceKey);

async function inspect() {
  console.log('Querying Voice Supabase Database (Account B)...');
  
  // Try querying organizations table in Voice DB
  const { data: orgs, error: orgsError } = await voiceSupabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (orgsError) {
    console.error('Error querying organizations in Voice DB:', orgsError.message);
  } else {
    console.log('Successfully queried organizations from Voice DB:');
    console.log(orgs);
  }

  // Try querying wallets table or similar in Voice DB if any
  const { data: wallets, error: walletsError } = await voiceSupabase
    .from('wallets')
    .select('*')
    .limit(1);

  if (walletsError) {
    console.log('Error querying wallets table in Voice DB:', walletsError.message);
  } else {
    console.log('Successfully queried wallets table from Voice DB:');
    console.log(wallets);
  }
}

inspect();
