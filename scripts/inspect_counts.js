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

async function runDiagnostics() {
  console.log("=== DIAGNÓSTICO DE PERFORMANCE ===");
  
  // 1. Contagem de registros
  console.log("1. Obtendo contagem de registros...");
  const t0 = performance.now();
  
  const { count: osCount, error: osErr } = await supabase
    .from('ordem_servico')
    .select('*', { count: 'exact', head: true });
    
  const { count: histCount, error: histErr } = await supabase
    .from('historico_ordem_servico')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Ordem Servico Count: ${osCount} (Erro: ${osErr?.message || 'Nenhum'})`);
  console.log(`Historico Count: ${histCount} (Erro: ${histErr?.message || 'Nenhum'})`);
  
  // 2. Tempo de execução da consulta principal de OS
  console.log("\n2. Medindo tempo da query principal de OS (com gte/lte)...");
  const t1 = performance.now();
  const { data: osData, error: osQueryErr } = await supabase
    .from('ordem_servico')
    .select('*')
    .gte('dt_ordem_servico', '2026-01-01T00:00:00Z')
    .lte('dt_ordem_servico', '2026-12-31T23:59:59.999Z')
    .order('dt_ordem_servico', { ascending: false });
  const t2 = performance.now();
  
  console.log(`Tempo da query principal: ${(t2 - t1).toFixed(2)} ms. Linhas retornadas: ${osData?.length || 0}`);
  if (osQueryErr) console.error("Erro na query de OS:", osQueryErr);

  // 3. Tempo de execução da busca de históricos
  if (osData && osData.length > 0) {
    console.log("\n3. Medindo tempo da busca de históricos por lista (.in)...");
    const nrSequencias = osData.map(o => o.nr_sequencia);
    const t3 = performance.now();
    const { data: histData, error: histQueryErr } = await supabase
      .from('historico_ordem_servico')
      .select('nr_sequencia')
      .in('nr_sequencia', nrSequencias);
    const t4 = performance.now();
    
    console.log(`Tempo da query de histórico: ${(t4 - t3).toFixed(2)} ms. Linhas retornadas: ${histData?.length || 0}`);
    if (histQueryErr) console.error("Erro na query de histórico:", histQueryErr);
  }
  
  console.log(`\nTempo total de diagnóstico: ${(performance.now() - t0).toFixed(2)} ms`);
}

runDiagnostics();
