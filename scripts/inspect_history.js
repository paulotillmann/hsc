import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Iniciando consulta ao historico_ordem_servico remoto...");
  
  // Como a leitura necessita de autenticação devido ao RLS, vamos ver se conseguimos autenticar 
  // com um usuário de teste ou se o anon_key consegue ler algo.
  // Se der erro de RLS, saberemos.
  const { data, error } = await supabase
    .from('historico_ordem_servico')
    .select('nr_sequencia, count()', { count: 'exact', head: false });
    
  if (error) {
    console.error("Erro na leitura de históricos:", error.message);
    
    // Tentando logar com credenciais anônimas ou ver se podemos ler direto
    const { data: data2, error: error2 } = await supabase
      .from('historico_ordem_servico')
      .select('*');
    if (error2) {
      console.error("Erro no select geral:", error2.message);
    } else {
      console.log("Dados retornados (Qtd):", data2.length);
      console.log("Registros:", data2);
    }
  } else {
    console.log("Históricos agregados:", data);
  }
}

test();
