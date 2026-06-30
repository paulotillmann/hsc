import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carrega variáveis de ambiente do .env
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

if (!SUPABASE_ANON_KEY) {
  console.error("Erro: VITE_SUPABASE_ANON_KEY não encontrada no arquivo .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const n8nEndpoints = {
  "Consulta OS": "https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_os",
  "Consulta Cirurgias": "https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_cirurgias",
  "Gestão de Pendências": "https://n8n-n8n.7woir1.easypanel.host/webhook/gestao_de_pendencias"
};

const edgeFunctions = {
  "sync-cirurgias": `${SUPABASE_URL}/functions/v1/sync-cirurgias`,
  "sync-ordem-servico": `${SUPABASE_URL}/functions/v1/sync-ordem-servico`,
  "sync-status-ordem-servico": `${SUPABASE_URL}/functions/v1/sync-status-ordem-servico`,
  "send-document-email (teste)": `${SUPABASE_URL}/functions/v1/send-document-email`
};

async function testSupabaseDatabase() {
  console.log("\n=== 1. TESTANDO CONEXÃO COM O BANCO DE DADOS SUPABASE ===");
  
  const tables = [
    { name: 'cirurgias', query: supabase.from('cirurgias').select('count', { count: 'exact', head: true }) },
    { name: 'ordem_servico', query: supabase.from('ordem_servico').select('count', { count: 'exact', head: true }) },
    { name: 'app_settings', query: supabase.from('app_settings').select('count', { count: 'exact', head: true }) },
    { name: 'historico_ordem_servico', query: supabase.from('historico_ordem_servico').select('count', { count: 'exact', head: true }) },
    { name: 'ordem_servico_estagio_log', query: supabase.from('ordem_servico_estagio_log').select('count', { count: 'exact', head: true }) }
  ];

  for (const table of tables) {
    try {
      const { count, error } = await table.query;
      if (error) {
        console.log(`❌ Tabela [${table.name}]: Falha ao consultar. Detalhes: ${error.message} (Código: ${error.code})`);
      } else {
        console.log(`✅ Tabela [${table.name}]: Conexão OK. Total de registros: ${count}`);
      }
    } catch (err) {
      console.log(`❌ Tabela [${table.name}]: Erro de rede ou exceção. Detalhes: ${err.message}`);
    }
  }
}

async function testN8nWebhooks() {
  console.log("\n=== 2. TESTANDO WEBHOOKS DO N8N ===");
  
  for (const [name, url] of Object.entries(n8nEndpoints)) {
    try {
      console.log(`Chamando ${name}...`);
      const body = name === "Gestão de Pendências" ? JSON.stringify({ action: 'list' }) : undefined;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      
      if (res.ok) {
        const text = await res.text();
        let recordsCount = 'Desconhecido';
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) recordsCount = `${json.length} registros`;
        } catch {}
        console.log(`✅ ${name} (${url}): OK (Status ${res.status}). Retorno: ${recordsCount}`);
      } else {
        console.log(`❌ ${name} (${url}): Falhou com Status ${res.status} - ${res.statusText}`);
      }
    } catch (err) {
      console.log(`❌ ${name} (${url}): Erro de conexão. Detalhes: ${err.message}`);
    }
  }
}

async function testEdgeFunctions() {
  console.log("\n=== 3. TESTANDO INVOLCAÇÃO DE SUPABASE EDGE FUNCTIONS ===");
  
  for (const [name, url] of Object.entries(edgeFunctions)) {
    try {
      console.log(`Invocando ${name}...`);
      
      let payload = {};
      if (name.includes("send-document-email")) {
        payload = {
          to: "teste-diagnostico@example.com",
          nomeColaborador: "Colaborador de Teste",
          tipoDocumento: "holerite",
          periodoReferencia: "05/2026",
          cpf: "000.000.000-00",
          pdfUrl: "https://example.com/teste.pdf",
          isTest: true
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });
      
      const responseText = await res.text();
      
      if (res.ok) {
        console.log(`✅ Edge Function [${name}]: OK (Status ${res.status}). Resposta: ${responseText.substring(0, 200)}`);
      } else {
        console.log(`❌ Edge Function [${name}]: Falhou com Status ${res.status}. Resposta: ${responseText}`);
      }
    } catch (err) {
      console.log(`❌ Edge Function [${name}]: Erro ao invocar. Detalhes: ${err.message}`);
    }
  }
}

async function main() {
  console.log("Iniciando Validação Geral de Conexões e Edge Functions...");
  console.log("Supabase URL:", SUPABASE_URL);
  
  await testSupabaseDatabase();
  await testN8nWebhooks();
  await testEdgeFunctions();
  
  console.log("\n=== FIM DO DIAGNÓSTICO ===");
}

main();
