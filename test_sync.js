import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.functions.invoke('trigger_n8n_sync_pacientes', {
    method: 'POST',
  });
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
