import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testJoin() {
  console.log("Testando query com relacionamento no PostgREST...");
  const { data, error } = await supabase
    .from('ordem_servico')
    .select('*, historico_ordem_servico(nr_sequencia)')
    .limit(1);

  if (error) {
    console.error("Erro na query de join:", error.message);
  } else {
    console.log("Query de join executada com sucesso!");
    console.log("Estrutura do resultado:", JSON.stringify(data, null, 2));
  }
}

testJoin();
