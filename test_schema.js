const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('organizations').select('favicon_url').limit(1);
  if (error) console.log("ERROR:", error.message);
  else console.log("SUCCESS, favicon_url exists.");
}
check();
