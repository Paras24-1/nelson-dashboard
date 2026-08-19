const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const orgId = 'f452203e-c1b4-49c9-87c7-2b7d7a4ce2e2';
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('gemini_api_key, ai_system_prompt')
    .eq('org_id', orgId)
    .single();
    
  const systemPrompt = `
${settings.ai_system_prompt}

IMPORTANT: You are a JSON-only API. You MUST output your final response STRICTLY as valid JSON.
Your JSON response MUST have exactly this structure:
{
  "replyMessage": "your message to the user",
  "scoreAdjustment": 0,
  "reasoning": "brief explanation",
  "extractedTimeline": "less than 30 days"
}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${settings.gemini_api_key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'name kya hai apka' }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: 'application/json' }
    })
  });
  
  const text = await response.text();
  console.log('Gemini Output:', text);
}
run();
