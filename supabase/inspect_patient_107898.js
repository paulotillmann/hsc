import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const { data, error } = await supabase
      .from('pacientes_pronto_atendimento')
      .select('*')
      .eq('nr_atendimento', 107898);

    if (error) throw error;
    
    console.log('--- PACIENTE ENCONTRADO ---');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erro:', error);
  }
}

run();
