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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("Checking some records in Supabase to inspect stored timestamps...");
  
  // 1. Ordem de Serviço
  const { data: osData, error: osError } = await supabase
    .from('ordem_servico')
    .select('nr_sequencia, dt_ordem_servico, dt_atualizacao, created_at')
    .limit(3);
    
  if (osError) {
    console.error("Error fetching Ordem Servico:", osError);
  } else {
    console.log("\n=== ORDEM DE SERVICO SAMPLE ===");
    osData.forEach(row => {
      console.log(`OS Seq: ${row.nr_sequencia}`);
      console.log(`  dt_ordem_servico: ${row.dt_ordem_servico}`);
      console.log(`  dt_atualizacao:   ${row.dt_atualizacao}`);
      console.log(`  created_at:       ${row.created_at}`);
    });
  }

  // 2. Cirurgias
  const { data: cirData, error: cirError } = await supabase
    .from('cirurgias')
    .select('id, dt_registro, created_at')
    .limit(3);
    
  if (cirError) {
    console.error("Error fetching Cirurgias:", osError);
  } else if (cirData) {
    console.log("\n=== CIRURGIAS SAMPLE ===");
    cirData.forEach(row => {
      console.log(`Cirurgia ID: ${row.id}`);
      console.log(`  dt_registro: ${row.dt_registro}`);
      console.log(`  created_at:  ${row.created_at}`);
    });
  }
}

main();
