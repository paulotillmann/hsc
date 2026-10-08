import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/usuarios_tasy';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatDiaMesExtenso(diaMesStr: string): string {
  if (!diaMesStr) return '-';
  const clean = diaMesStr.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const mNum = parseInt(parts[1], 10);
      if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        return `${parts[0].padStart(2, '0')}/${MESES_ABREV[mNum - 1]}`;
      }
    }
  }
  return clean;
}

function getBrasiliaDateKey(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getBrasiliaCurrentMinutes(): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.format(now).split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
    return now.getHours() * 60 + now.getMinutes();
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

function getMinutesFromTimeStr(timeVal: any): number | null {
  if (!timeVal || timeVal === '-') return null;
  try {
    if (typeof timeVal === 'object' && timeVal instanceof Date) {
      return timeVal.getHours() * 60 + timeVal.getMinutes();
    }
    const str = String(timeVal).trim();
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const formatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const [h, m] = formatter.format(d).split(':').map(Number);
        return h * 60 + m;
      }
    }
    const parts = str.split(' ');
    const timePart = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const timeElements = timePart.split(':');
    if (timeElements.length < 2) return null;

    const h = parseInt(timeElements[0], 10);
    const m = parseInt(timeElements[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function formatTimeDisplay(timeVal: any): string {
  if (!timeVal || timeVal === '-') return '-';
  try {
    if (typeof timeVal === 'object' && timeVal instanceof Date) {
      return timeVal.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    }
    const str = String(timeVal).trim();
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }
    return str;
  } catch {
    return String(timeVal);
  }
}

function calculateDuration(inicioStr: string): { formatada: string; minutos: number } {
  const minInicio = getMinutesFromTimeStr(inicioStr);
  if (minInicio === null) {
    return { formatada: '-', minutos: 0 };
  }

  const minRef = getBrasiliaCurrentMinutes();
  let totalMinutos = minRef - minInicio;
  if (totalMinutos < 0) {
    totalMinutos += 24 * 60;
  }

  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;

  if (horas === 0) {
    return { formatada: `${minutos}min`, minutos: totalMinutos };
  }
  return { formatada: `${horas}h ${minutos.toString().padStart(2, '0')}m`, minutos: totalMinutos };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Sync Tasy Snapshot] Iniciando captura do snapshot diário...');

    let customDataReferencia: string | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (body && body.data_referencia) {
          customDataReferencia = String(body.data_referencia).trim();
        }
      }
    } catch { }

    const dataReferencia = customDataReferencia || getBrasiliaDateKey();
    console.log(`[Sync Tasy Snapshot] Data de referência: ${dataReferencia}`);

    // 1. Consulta o webhook n8n de usuários Tasy
    console.log(`[Sync Tasy Snapshot] Chamando webhook: ${N8N_WEBHOOK_URL}`);
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'snapshot_2350', data_referencia: dataReferencia })
    });

    if (!n8nResponse.ok) {
      throw new Error(`Erro ao consultar o webhook do Tasy: HTTP ${n8nResponse.status} - ${n8nResponse.statusText}`);
    }

    const responseText = await n8nResponse.text();
    if (!responseText || !responseText.trim()) {
      throw new Error('Webhook do n8n retornou corpo vazio para usuários Tasy.');
    }

    const parsedJson = JSON.parse(responseText);
    let rawList: any[] = [];
    if (Array.isArray(parsedJson)) {
      rawList = parsedJson;
    } else if (parsedJson && typeof parsedJson === 'object') {
      if (Array.isArray(parsedJson.data)) rawList = parsedJson.data;
      else if (Array.isArray(parsedJson.rows)) rawList = parsedJson.rows;
      else if (Array.isArray(parsedJson.items)) rawList = parsedJson.items;
      else if (Array.isArray(parsedJson.result)) rawList = parsedJson.result;
      else rawList = [parsedJson];
    }

    console.log(`[Sync Tasy Snapshot] Dados recebidos do n8n: ${rawList.length} itens brutos.`);

    // 2. Normalização dos dados
    let quantTotal: number | null = null;
    let picoQtd: number | null = null;
    let picoHora: string | null = null;
    let parsedSlots: any[] = [];

    const first = rawList[0];
    if (first) {
      const itemFirst = first.json && typeof first.json === 'object' ? first.json : first;
      if (itemFirst['Quant.'] !== undefined && itemFirst['Quant.'] !== null) quantTotal = Number(itemFirst['Quant.']);

      if (itemFirst.PICO_QTD !== undefined && itemFirst.PICO_QTD !== null) picoQtd = Number(itemFirst.PICO_QTD);
      else if (itemFirst.pico_qtd !== undefined && itemFirst.pico_qtd !== null) picoQtd = Number(itemFirst.pico_qtd);

      if (itemFirst.PICO_HORA) picoHora = String(itemFirst.PICO_HORA).trim();
      else if (itemFirst.pico_hora) picoHora = String(itemFirst.pico_hora).trim();

      const rawHistoricoStr = itemFirst.HISTORICO_SLOTS || itemFirst.historico_slots;
      if (rawHistoricoStr && typeof rawHistoricoStr === 'string') {
        const entries = rawHistoricoStr.split(';').filter(Boolean);
        parsedSlots = entries.map(entry => {
          const [dtHora, countStr] = entry.split('=');
          const [dt, hr] = (dtHora || '').trim().split(' ');
          const count = parseInt(countStr, 10) || 0;
          return {
            diaMes: formatDiaMesExtenso(dt || ''),
            hora: hr || '-',
            quant: count
          };
        });
      } else if (itemFirst.HISTORICO_JSON || itemFirst.historico_json) {
        try {
          const rawJson = itemFirst.HISTORICO_JSON || itemFirst.historico_json;
          const arr = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
          if (Array.isArray(arr)) {
            parsedSlots = arr.map(item => ({
              diaMes: formatDiaMesExtenso(item.data || item.diaMes || item['Dia/Mês'] || ''),
              hora: item.hora || item.hour || '-',
              quant: Number(item.quant || item.count || item.value || 0)
            }));
          }
        } catch { }
      }
    }

    const userList: any[] = [];
    let duracaoTotalMinutos = 0;
    let duracaoCount = 0;

    rawList.forEach((raw, idx) => {
      if (!raw || typeof raw !== 'object') return;
      const item = raw.json && typeof raw.json === 'object' ? raw.json : raw;

      const rawNome = item.NM_SUBJECT || item.nm_subject || item.NOME || item.nome || item.NM_USUARIO || item.nm_usuario || item.name;
      const rawLogin = item.DS_LOGIN || item.ds_login || item.LOGIN || item.login || item.CD_USUARIO || item.cd_usuario || item.usuario || item.user;
      const rawSetor = item.DS_SETOR || item.ds_setor || item.setor || item.departamento || item.unidade || item.posto || item.NM_SETOR || item.nm_setor;
      const rawInicio = item.DT_CREATION || item.dt_creation || item['Início'] || item.inicio || item.INICIO || item.hr_inicio || item.dt_inicio;
      const rawFim = item.DT_EXPIRATION || item.dt_expiration || item['Fim'] || item.fim || item.FIM || item.hr_fim || item.dt_fim;

      if (!rawNome && !rawLogin) return;

      const nome = (rawNome || rawLogin || `Usuário ${idx + 1}`).toString().trim();
      const login = (rawLogin || '-').toString().trim();
      const setor = (rawSetor || 'Não Informado').toString().trim();
      const inicio = formatTimeDisplay(rawInicio);
      const fim = formatTimeDisplay(rawFim);

      const { formatada: duracaoFormatada, minutos: duracaoMinutos } = calculateDuration(rawInicio);

      if (duracaoMinutos > 0) {
        duracaoTotalMinutos += duracaoMinutos;
        duracaoCount++;
      }

      userList.push({
        login,
        nome,
        setor,
        inicio,
        fim,
        duracaoFormatada,
        duracaoMinutos,
        status: 'ATIVO',
      });
    });

    // Identifica pico nos slots
    if (parsedSlots.length > 0) {
      const maxVal = Math.max(...parsedSlots.map(s => s.quant));
      parsedSlots = parsedSlots.map(s => ({
        ...s,
        isPeak: s.quant === maxVal && maxVal > 0
      }));

      if (!picoQtd || picoQtd === 0) {
        const peakSlot = parsedSlots.find(s => s.isPeak);
        if (peakSlot) {
          picoQtd = peakSlot.quant;
          picoHora = peakSlot.hora;
        }
      }
    }

    const totalConectados = quantTotal || userList.length;
    const totalLicencas = 150;
    const percentualOcupacao = Math.min(Math.round((totalConectados / totalLicencas) * 100), 100);

    const mediaMinutos = duracaoCount > 0 ? Math.round(duracaoTotalMinutos / duracaoCount) : 0;
    const mediaHoras = Math.floor(mediaMinutos / 60);
    const mediaMinsRestantes = mediaMinutos % 60;
    const mediaTempoFormatada = mediaHoras > 0
      ? `${mediaHoras}h ${mediaMinsRestantes.toString().padStart(2, '0')}m`
      : `${mediaMinsRestantes}min`;

    const snapshotPayload = {
      data_referencia: dataReferencia,
      total_conectados: totalConectados,
      pico_quantidade: picoQtd || totalConectados,
      pico_horario: picoHora || '-',
      percentual_ocupacao: percentualOcupacao,
      media_tempo_formatada: mediaTempoFormatada,
      media_tempo_minutos: mediaMinutos,
      historico_slots: parsedSlots,
      usuarios_lista: userList,
      updated_at: new Date().toISOString()
    };

    console.log(`[Sync Tasy Snapshot] Consolidado: ${totalConectados} conectados, Pico: ${snapshotPayload.pico_quantidade} às ${snapshotPayload.pico_horario}, Ocupação: ${percentualOcupacao}%`);

    // 3. Salvar no Supabase
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: savedData, error: saveError } = await supabase
      .from('tasy_snapshots_diarios')
      .upsert(snapshotPayload, { onConflict: 'data_referencia' })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Erro ao persistir snapshot no Supabase: ${saveError.message}`);
    }

    console.log('[Sync Tasy Snapshot] Snapshot salvo com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Snapshot do dia ${dataReferencia} persistido com sucesso às 23:50.`,
        data: savedData
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Sync Tasy Snapshot] Erro no fluxo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao processar snapshot diário do Tasy.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
