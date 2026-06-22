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

const parseTasyDate = (dateStr) => {
  if (!dateStr) return null;
  const normalizedStr = dateStr.replace(/(Z|\+00:00|\+00)$/i, '-03:00');
  return new Date(normalizedStr);
};

const formatDuration = (ms) => {
  if (ms <= 0) return '0m';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
};

async function testAverages() {
  console.log("=== TESTANDO MÉDIAS DE TEMPO ===");
  
  // 1. Buscar ordens
  const { data: orders, error: dbError } = await supabase
    .from('ordem_servico')
    .select('*, historico_ordem_servico(nr_sequencia)')
    .gte('dt_ordem_servico', '2026-01-01T00:00:00Z')
    .lte('dt_ordem_servico', '2026-12-31T23:59:59.999Z')
    .order('dt_ordem_servico', { ascending: false });

  if (dbError) {
    console.error("Erro ao buscar ordens:", dbError);
    return;
  }

  console.log(`Total de ordens carregadas: ${orders?.length}`);

  const orderNums = orders.map(o => o.nr_sequencia);
  const { data: stageLogs, error: logsError } = await supabase
    .from('ordem_servico_estagio_log')
    .select('nr_sequencia, estagio_kanban, dt_transicao')
    .in('nr_sequencia', orderNums)
    .order('dt_transicao', { ascending: true });

  if (logsError) {
    console.error("Erro ao buscar logs:", logsError);
    return;
  }

  console.log(`Total de logs de estágio carregados: ${stageLogs?.length}`);

  // Testar cálculo de Triagem
  let totalTriagemMs = 0;
  let countTriagem = 0;
  const now = new Date().getTime();
  const logsByOrder = new Map();
  stageLogs.forEach(log => {
    if (!logsByOrder.has(log.nr_sequencia)) {
      logsByOrder.set(log.nr_sequencia, []);
    }
    logsByOrder.get(log.nr_sequencia).push(log);
  });

  orders.forEach(order => {
    // Verificar se ela está em triagem ou encerrada no filtro geral
    const situacao = (order.ds_situacao || '').toLowerCase();
    const encer = (order.nm_usuario_encer || '').trim();
    const estagio = (order.ds_estagio || '').trim();
    const estagioLower = estagio.toLowerCase();

    const isFinalizado =
      situacao.includes('finalizada') ||
      situacao.includes('finalizado') ||
      situacao.includes('encerrada') ||
      situacao.includes('concluída') ||
      situacao.includes('concluido') ||
      encer !== '' ||
      estagioLower.includes('encerrad');

    const isTriagem = !isFinalizado && estagio === '';

    // Se a OS estiver na triagem
    if (isTriagem) {
      const orderLogs = logsByOrder.get(order.nr_sequencia) || [];
      const triagemLog = orderLogs.find(l => l.estagio_kanban === 'triagem');
      let triagemStart = triagemLog 
        ? new Date(triagemLog.dt_transicao).getTime() 
        : (parseTasyDate(order.dt_ordem_servico)?.getTime() || 0);

      if (triagemStart === 0) return;

      const nextLog = orderLogs.find(l => 
        l.estagio_kanban !== 'triagem' && 
        new Date(l.dt_transicao).getTime() > triagemStart
      );

      let triagemEnd = nextLog 
        ? new Date(nextLog.dt_transicao).getTime() 
        : now;

      const duration = triagemEnd - triagemStart;
      if (duration > 0) {
        totalTriagemMs += duration;
        countTriagem++;
      }
    }
  });

  console.log(`Média Triagem (ms): ${countTriagem > 0 ? totalTriagemMs / countTriagem : 0}`);
  console.log(`Contagem Triagem: ${countTriagem}`);
  console.log(`Média Formatada Triagem: ${formatDuration(countTriagem > 0 ? totalTriagemMs / countTriagem : 0)}`);
}

testAverages();
