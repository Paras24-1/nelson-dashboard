const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function check() {
  const { data, error } = await supabaseAdmin.from('organizations').select('name, custom_domain, brand_title');
  console.log("DB DATA:", data);
  if (error) console.error("DB ERROR:", error);
}

check();
