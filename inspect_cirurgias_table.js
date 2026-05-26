import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Função auxiliar para carregar o .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testQuery() {
  console.log("Consultando tabela 'cirurgias'...");
  const { data, error } = await supabase
    .from('cirurgias')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Erro na consulta:", error);
    return;
  }

  console.log("Registros encontrados:", data.length);
  if (data.length > 0) {
    console.log("Campos em um registro de cirurgia:", Object.keys(data[0]));
    console.log("Exemplo de registro:");
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log("Nenhum registro encontrado na tabela 'cirurgias'.");
  }
}

testQuery();
