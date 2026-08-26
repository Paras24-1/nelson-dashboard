const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data, error } = await supabaseAdmin.from('messages')
    .update({ message: "⚠️ Message failed to deliver to customer (Meta API Error). We have hidden the error block." })
    .like('message', 'META_ERROR:%');
  console.log("Fixed messages:", error ? error : "Success");
}
fix();
