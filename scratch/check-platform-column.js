const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jncmizoejeaclpnfxazg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY21pem9lamVhY2xwbmZ4YXpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMTczMiwiZXhwIjoyMDkyNzA3NzMyfQ.A8A4tMGzUFuhH4DOSb77QByuKmNdajZ_kCRvr_yxqFo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('conversations')
    .select('platform')
    .limit(1);
    
  if (error) {
    console.error('Error checking column:', error);
  } else {
    console.log('Success! platform column exists. Columns fetched:', data);
  }
}

checkSchema();
