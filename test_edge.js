import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY; // Oops, we don't have the service role key in .env

async function test() {
  // Let's just do a fetch directly using the ANON_KEY and see if it gives 401
  const response = await fetch(`${SUPABASE_URL}/functions/v1/trigger_n8n_sync_pacientes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Body:", text);
}
test();
