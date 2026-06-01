import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const { data: cirurgias, error } = await supabase
      .from('cirurgias')
      .select('nr_cirurgia, nm_paciente, sala, evento, dt_registro')
      .limit(5);

    if (error) throw error;
    
    console.log('--- CIRURGIAS ENCONTRADAS ---');
    console.log(cirurgias);
  } catch (error) {
    console.error('Erro:', error);
  }
}

run();
