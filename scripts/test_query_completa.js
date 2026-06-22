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

async function testQueryCompleta() {
  console.log("Executando query exata da página OrdemServico...");
  const { data, error } = await supabase
    .from('ordem_servico')
    .select('*, historico_ordem_servico(nr_sequencia)')
    .gte('dt_ordem_servico', '2026-01-01T00:00:00Z')
    .lte('dt_ordem_servico', '2026-12-31T23:59:59.999Z')
    .order('dt_ordem_servico', { ascending: false });

  if (error) {
    console.error("❌ Erro retornado pela query:", error);
  } else {
    console.log("✅ Query executada com sucesso!");
    console.log("Número de registros:", data.length);
    if (data.length > 0) {
      console.log("Exemplo de registro:", JSON.stringify(data[0], null, 2));
    }
  }
}

testQueryCompleta();
