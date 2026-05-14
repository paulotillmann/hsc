import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://drbzogwimvaziaydwqfk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function clearSenhas() {
  console.log('Tentando excluir os registros...');
  const { data, error } = await supabase
    .from('senhas')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // hack para excluir todos
    
  if (error) {
    console.error('Erro ao excluir:', error.message);
  } else {
    console.log('Registros da tabela senhas excluídos com sucesso!', data);
  }
}

clearSenhas();
