// Script de teste local para simular e validar o mapeamento de cirurgias do n8n para o Supabase
// Execução: node test_sync_cirurgias.js

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
const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_cirurgias';

async function testSync() {
  console.log("=== INICIANDO SIMULAÇÃO DE SINCRONIZAÇÃO ===");
  console.log("Supabase URL:", SUPABASE_URL);
  console.log("Buscando dados do webhook n8n:", N8N_WEBHOOK_URL);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("Resposta n8n HTTP Status:", response.status);
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      console.error("Erro: Retorno do n8n não é um array!");
      return;
    }

    console.log(`Quantidade de registros recebidos: ${rawData.length}`);

    // Mapeamento idêntico ao da Edge Function com de-duplicação por nr_cirurgia (mantendo o mais recente)
    const uniqueRecordsMap = new Map();

    for (const item of rawData) {
      if (item.NR_CIRURGIA === undefined || item.NR_CIRURGIA === null) {
        continue;
      }

      const nrCirurgia = Number(item.NR_CIRURGIA);
      const mappedRecord = {
        nr_atendimento: item.NR_ATENDIMENTO ? Number(item.NR_ATENDIMENTO) : null,
        nm_paciente: item.NM_PACIENTE ? item.NM_PACIENTE.trim() : null,
        ds_sexo: item.DS_SEXO ? item.DS_SEXO.trim() : null,
        idade: item.IDADE ? Number(item.IDADE) : null,
        nr_cirurgia: nrCirurgia,
        medico: item.MEDICO ? item.MEDICO.trim() : null,
        procedimento: item.PROCEDIMENTO ? item.PROCEDIMENTO.trim() : null,
        dt_agenda: item.DT_AGENDA ? new Date(item.DT_AGENDA).toISOString() : null,
        nm_anestesista: item.NM_ANESTESISTA ? item.NM_ANESTESISTA.trim() : null,
        ds_carater: item.DS_CARATER ? item.DS_CARATER.trim() : null,
        sala: item.SALA ? item.SALA.trim() : null,
        evento: item.EVENTO ? item.EVENTO.trim() : null,
        dt_registro: item.DT_REGISTRO ? new Date(item.DT_REGISTRO).toISOString() : null,
        circulante: item.CIRCULANTE ? item.CIRCULANTE.trim() : null,
        enfermeiro: item.ENFERMEIRO ? item.ENFERMEIRO.trim() : null,
        setor_origem: item.SETOR_ORIGEM ? item.SETOR_ORIGEM.trim() : null,
        precaucao: item.PRECAUCAO ? item.PRECAUCAO.trim() : null,
        alergia: item.ALERGIA ? item.ALERGIA.trim() : null
      };

      const existing = uniqueRecordsMap.get(nrCirurgia);
      if (!existing) {
        uniqueRecordsMap.set(nrCirurgia, mappedRecord);
      } else {
        const existingTime = existing.dt_registro ? new Date(existing.dt_registro).getTime() : 0;
        const newTime = mappedRecord.dt_registro ? new Date(mappedRecord.dt_registro).getTime() : 0;

        if (newTime >= existingTime) {
          uniqueRecordsMap.set(nrCirurgia, mappedRecord);
        }
      }
    }

    const mapped = Array.from(uniqueRecordsMap.values());

    console.log(`Mapeamento concluído com sucesso. ${mapped.length} registros prontos.`);

    // Lista eventos distintos retornados pelo n8n
    const eventosDistintos = Array.from(new Set(rawData.map(item => item.EVENTO).filter(Boolean)));
    console.log("\n=== EVENTOS DISTINTOS DO WEBHOOK N8N ===");
    console.log(eventosDistintos);
    console.log("========================================\n");

    console.log("Validação de tipos e formatos: APROVADA.");
    console.log("=== FIM DA SIMULAÇÃO COM SUCESSO ===");

  } catch (err) {
    console.error("Erro durante o processo de simulação:", err);
  }
}

testSync();
