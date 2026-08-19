const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jncmizoejeaclpnfxazg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY21pem9lamVhY2xwbmZ4YXpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMTczMiwiZXhwIjoyMDkyNzA3NzMyfQ.A8A4tMGzUFuhH4DOSb77QByuKmNdajZ_kCRvr_yxqFo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  try {
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, org_id, role')
      .eq('email', 'ashish@unarstech.com')
      .maybeSingle();

    if (userError) throw userError;
    if (!userRecord) {
      console.log('User ashish@unarstech.com not found.');
      return;
    }

    console.log('User found:', userRecord);

    if (userRecord.org_id) {
      const { data: orgRecord, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('id', userRecord.org_id)
        .maybeSingle();

      if (orgError) throw orgError;
      console.log('Organization found:', orgRecord);
    }
  } catch (err) {
    console.error(err);
  }
}

checkUser();
