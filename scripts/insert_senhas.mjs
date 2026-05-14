import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://drbzogwimvaziaydwqfk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function insertSenhas() {
  console.log('Gerando 7 senhas aleatorias (4 normais, 3 preferenciais)...');

  // 7 senhas
  const tipos = [
    'preferencial', 'preferencial', 'preferencial',
    'normal', 'normal', 'normal', 'normal'
  ];

  // Embaralha o array
  for (let i = tipos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
  }

  // Insere sequencialmente
  for (let i = 0; i < tipos.length; i++) {
    const tipo = tipos[i];
    const { data, error } = await supabase.rpc('gerar_senha', { p_tipo: tipo });
    
    if (error) {
      console.error(`Erro ao gerar senha ${tipo}:`, error.message);
    } else {
      console.log(`[${i + 1}/7] Senha gerada com sucesso: ${data.codigo} (${tipo})`);
    }
    
    // Pequeno delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('Concluído!');
}

insertSenhas();
