import { supabase } from '../lib/supabase';

export interface NpsReportFilters {
  startDate: string; // ISO string or YYYY-MM-DD
  endDate: string;   // ISO string or YYYY-MM-DD
  periodoLabel: string;
}

export interface NpsReportData {
  periodoLabel: string;
  dataGeracao: string;
  totalRespondentes: number;
  npsScore: number;
  promotoresCount: number;
  promotoresPct: number;
  neutrosCount: number;
  neutrosPct: number;
  detratoresCount: number;
  detratoresPct: number;
  mediaEquipe: number | null;
  mediaGeral: number | null;
  distribuicaoNotas: { nota: number; count: number; pct: number }[];
  distribuicaoSetores: {
    setor: string;
    count: number;
    pct: number;
    npsScore: number;
    promotores: number;
    neutros: number;
    detratores: number;
  }[];
  comentarios: {
    id: string;
    nome: string;
    dataHora: string;
    setor: string;
    npsScore?: number;
    classificacao?: 'promoter' | 'neutral' | 'detractor';
    feedbackPositivo?: string;
    feedbackNegativo?: string;
    duvida?: string;
  }[];
}

export interface SendNpsReportResponse {
  success: boolean;
  error?: string;
  recipientsCount?: number;
  recipients?: string[];
}

const LOGO_URL = 'https://drbzogwimvaziaydwqfk.supabase.co/storage/v1/object/public/assets/logo_hsc_white.png';

/**
 * Normaliza as datas para início do dia e fim do dia UTC/ISO
 */
export function normalizeDateRange(startStr: string, endStr: string) {
  const start = new Date(startStr.includes('T') ? startStr : `${startStr}T00:00:00`);
  const end = new Date(endStr.includes('T') ? endStr : `${endStr}T23:59:59.999`);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

/**
 * Busca dados consolidados de NPS para o período
 */
export async function fetchNpsReportData(filters: NpsReportFilters): Promise<NpsReportData> {
  const { startIso, endIso } = normalizeDateRange(filters.startDate, filters.endDate);

  // 1. Busca respondentes no período
  const { data: respondents, error: rError } = await supabase
    .from('pesquisa_respondentes')
    .select('id, created_at, nome, duvida, telefone, endereco')
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false });

  if (rError) throw rError;

  const respList = respondents || [];
  const respondentIds = respList.map((r) => r.id);

  // 2. Busca todas as respostas desse grupo
  let answers: any[] = [];
  if (respondentIds.length > 0) {
    const { data: aData, error: aError } = await supabase
      .from('pesquisa_respostas')
      .select('id, respondente_id, pergunta_id, resposta, created_at')
      .in('respondente_id', respondentIds);

    if (aError) throw aError;
    answers = aData || [];
  }

  // 3. Processamento de NPS
  let promotores = 0;
  let neutros = 0;
  let detratores = 0;

  const distribuicaoNotasMap: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) distribuicaoNotasMap[i] = 0;

  const respondentNpsMap = new Map<string, { score: number; classification: 'promoter' | 'neutral' | 'detractor' }>();

  answers
    .filter((a) => a.pergunta_id === 'nps_recomendacao')
    .forEach((a) => {
      const score = parseInt(String(a.resposta), 10);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        distribuicaoNotasMap[score] = (distribuicaoNotasMap[score] || 0) + 1;

        let classification: 'promoter' | 'neutral' | 'detractor' = 'neutral';
        if (score >= 9) {
          promotores++;
          classification = 'promoter';
        } else if (score >= 7) {
          neutros++;
          classification = 'neutral';
        } else {
          detratores++;
          classification = 'detractor';
        }

        respondentNpsMap.set(a.respondente_id, { score, classification });
      }
    });

  const totalNpsRespondentes = promotores + neutros + detratores;
  const npsScore = totalNpsRespondentes > 0
    ? Math.round(((promotores - detratores) / totalNpsRespondentes) * 100)
    : 0;

  const promotoresPct = totalNpsRespondentes > 0 ? parseFloat(((promotores / totalNpsRespondentes) * 100).toFixed(1)) : 0;
  const neutrosPct = totalNpsRespondentes > 0 ? parseFloat(((neutros / totalNpsRespondentes) * 100).toFixed(1)) : 0;
  const detratoresPct = totalNpsRespondentes > 0 ? parseFloat(((detratores / totalNpsRespondentes) * 100).toFixed(1)) : 0;

  const distribuicaoNotas = Object.entries(distribuicaoNotasMap).map(([notaStr, count]) => {
    const nota = parseInt(notaStr, 10);
    const pct = totalNpsRespondentes > 0 ? parseFloat(((count / totalNpsRespondentes) * 100).toFixed(1)) : 0;
    return { nota, count, pct };
  });

  // 4. Médias de Equipe e Geral (1 a 5 estrelas)
  const equipeAnswers = answers.filter((a) => a.pergunta_id === 'avaliacao_equipe');
  const geralAnswers = answers.filter((a) => a.pergunta_id === 'avaliacao_geral');

  let mediaEquipe: number | null = null;
  if (equipeAnswers.length > 0) {
    const sum = equipeAnswers.reduce((acc, a) => acc + (parseInt(String(a.resposta), 10) || 0), 0);
    mediaEquipe = parseFloat((sum / equipeAnswers.length).toFixed(1));
  }

  let mediaGeral: number | null = null;
  if (geralAnswers.length > 0) {
    const sum = geralAnswers.reduce((acc, a) => acc + (parseInt(String(a.resposta), 10) || 0), 0);
    mediaGeral = parseFloat((sum / geralAnswers.length).toFixed(1));
  }

  // 5. Compilação de Comentários dos Usuários (apenas pesquisas que possuem comentários escritos)
  const comentarios: NpsReportData['comentarios'] = [];

  respList.forEach((r) => {
    const rAnswers = answers.filter((a) => a.respondente_id === r.id);
    const posAns = rAnswers.find((a) => a.pergunta_id === 'feedback_positivo')?.resposta;
    const negAns = rAnswers.find((a) => a.pergunta_id === 'feedback_negativo')?.resposta;
    const setorAns = rAnswers.find((a) => a.pergunta_id === 'setor_atendimento')?.resposta;
    const npsInfo = respondentNpsMap.get(r.id);

    const hasPos = typeof posAns === 'string' && posAns.trim().length > 0;
    const hasNeg = typeof negAns === 'string' && negAns.trim().length > 0;
    const hasDuvida = typeof r.duvida === 'string' && r.duvida.trim().length > 0;

    // Normaliza o setor de atendimento
    let setor = 'Setor não informado';
    if (setorAns) {
      if (Array.isArray(setorAns) && setorAns.length > 0) {
        setor = setorAns.filter(Boolean).join(', ');
      } else if (typeof setorAns === 'string') {
        try {
          const parsed = JSON.parse(setorAns);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setor = parsed.filter(Boolean).join(', ');
          } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
            setor = parsed.trim();
          } else if (setorAns.trim().length > 0) {
            setor = setorAns.trim();
          }
        } catch {
          if (setorAns.trim().length > 0) {
            setor = setorAns.trim();
          }
        }
      }
    }

    // Exibe apenas se houver pelo menos um comentário ou dúvida por escrito
    if (hasPos || hasNeg || hasDuvida) {
      const dt = new Date(r.created_at);
      const dataHora = dt.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      comentarios.push({
        id: r.id,
        nome: r.nome ? r.nome.trim() : 'Participante Anônimo',
        dataHora,
        setor,
        npsScore: npsInfo?.score,
        classificacao: npsInfo?.classification,
        feedbackPositivo: hasPos ? String(posAns).trim() : undefined,
        feedbackNegativo: hasNeg ? String(negAns).trim() : undefined,
        duvida: hasDuvida ? String(r.duvida).trim() : undefined
      });
    }
  });

  // 6. Totalização de Avaliações por Setor
  const setorStatsMap = new Map<string, {
    count: number;
    promoters: number;
    neutrals: number;
    detractors: number;
  }>();

  respList.forEach((r) => {
    const rAnswers = answers.filter((a) => a.respondente_id === r.id);
    const setorAns = rAnswers.find((a) => a.pergunta_id === 'setor_atendimento')?.resposta;
    const npsInfo = respondentNpsMap.get(r.id);

    let listSetores: string[] = [];
    if (setorAns) {
      if (Array.isArray(setorAns) && setorAns.length > 0) {
        listSetores = setorAns.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof setorAns === 'string') {
        try {
          const parsed = JSON.parse(setorAns);
          if (Array.isArray(parsed) && parsed.length > 0) {
            listSetores = parsed.map(s => String(s).trim()).filter(Boolean);
          } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
            listSetores = [parsed.trim()];
          } else if (setorAns.trim().length > 0) {
            listSetores = [setorAns.trim()];
          }
        } catch {
          if (setorAns.trim().length > 0) {
            listSetores = [setorAns.trim()];
          }
        }
      }
    }

    if (listSetores.length === 0) {
      listSetores = ['Setor não informado'];
    }

    listSetores.forEach((setorNome) => {
      const current = setorStatsMap.get(setorNome) || { count: 0, promoters: 0, neutrals: 0, detractors: 0 };
      current.count++;
      if (npsInfo) {
        if (npsInfo.classification === 'promoter') current.promoters++;
        else if (npsInfo.classification === 'neutral') current.neutrals++;
        else if (npsInfo.classification === 'detractor') current.detractors++;
      }
      setorStatsMap.set(setorNome, current);
    });
  });

  const totalAvaliacoesSetores = Array.from(setorStatsMap.values()).reduce((acc, s) => acc + s.count, 0);

  const distribuicaoSetores = Array.from(setorStatsMap.entries()).map(([setorNome, stats]) => {
    const totalNpsSetor = stats.promoters + stats.neutrals + stats.detractors;
    const npsScoreSetor = totalNpsSetor > 0
      ? Math.round(((stats.promoters - stats.detractors) / totalNpsSetor) * 100)
      : 0;
    const pct = totalAvaliacoesSetores > 0
      ? parseFloat(((stats.count / totalAvaliacoesSetores) * 100).toFixed(1))
      : 0;

    return {
      setor: setorNome,
      count: stats.count,
      pct,
      npsScore: npsScoreSetor,
      promotores: stats.promoters,
      neutros: stats.neutrals,
      detratores: stats.detractors
    };
  });

  distribuicaoSetores.sort((a, b) => b.count - a.count);

  return {
    periodoLabel: filters.periodoLabel,
    dataGeracao: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    totalRespondentes: respList.length,
    npsScore,
    promotoresCount: promotores,
    promotoresPct,
    neutrosCount: neutros,
    neutrosPct,
    detratoresCount: detratores,
    detratoresPct,
    mediaEquipe,
    mediaGeral,
    distribuicaoNotas,
    distribuicaoSetores,
    comentarios
  };
}

/**
 * Constrói o HTML responsivo, corporativo e com suporte nativo de e-mail (compatível com Outlook, Gmail, Apple Mail)
 */
export function buildNpsReportHtml(data: NpsReportData): string {
  // Determina zona de classificação NPS
  let zoneLabel = 'Zona de Aperfeiçoamento';
  let zoneColor = '#d97706'; // Âmbar
  let zoneBg = '#fef3c7';

  if (data.npsScore >= 75) {
    zoneLabel = 'Zona de Excelência';
    zoneColor = '#059669'; // Verde
    zoneBg = '#d1fae5';
  } else if (data.npsScore >= 50) {
    zoneLabel = 'Zona de Qualidade';
    zoneColor = '#0284c7'; // Azul
    zoneBg = '#e0f2fe';
  } else if (data.npsScore < 0) {
    zoneLabel = 'Zona Crítica';
    zoneColor = '#dc2626'; // Vermelho
    zoneBg = '#fee2e2';
  }

  const scoreFormatted = data.npsScore > 0 ? `+${data.npsScore}` : `${data.npsScore}`;

  // Barras de distribuição de 0 a 10
  const distribuicaoRows = data.distribuicaoNotas
    .map((item) => {
      let barColor = '#dc2626'; // 0-6 Detratores
      if (item.nota >= 9) barColor = '#059669'; // 9-10 Promotores
      else if (item.nota >= 7) barColor = '#d97706'; // 7-8 Neutros

      const barWidth = Math.max(item.pct, item.count > 0 ? 3 : 0);

      return `
        <tr>
          <td style="padding: 6px 10px; font-size: 13px; font-weight: 700; color: #334155; width: 45px; text-align: center;">
            Nota ${item.nota}
          </td>
          <td style="padding: 6px 10px;">
            <div style="background-color: #f1f5f9; border-radius: 6px; overflow: hidden; height: 18px; width: 100%;">
              <div style="background-color: ${barColor}; width: ${barWidth}%; height: 18px; border-radius: 6px;"></div>
            </div>
          </td>
          <td style="padding: 6px 10px; font-size: 13px; font-weight: 600; color: #475569; width: 110px; text-align: right; white-space: nowrap;">
            ${item.count} (${item.pct}%)
          </td>
        </tr>
      `;
    })
    .join('');

  // Barras de totalização por Setor de Atendimento
  const maxSetorCount = Math.max(...data.distribuicaoSetores.map((s) => s.count), 1);
  const distribuicaoSetoresRows = data.distribuicaoSetores.length === 0
    ? `
      <tr>
        <td style="padding: 16px; text-align: center; color: #64748b; font-size: 13px; background: #f8fafc; border-radius: 8px;">
          Nenhum setor registrado para as pesquisas deste período.
        </td>
      </tr>
    `
    : data.distribuicaoSetores
        .map((item) => {
          let barColor = '#d97706'; // Âmbar (Aperfeiçoamento 0-49)
          if (item.npsScore >= 75) barColor = '#059669'; // Verde (Excelência 75-100)
          else if (item.npsScore >= 50) barColor = '#0284c7'; // Azul (Qualidade 50-74)
          else if (item.npsScore < 0) barColor = '#dc2626'; // Vermelho (Crítica <0)

          const npsFormatted = item.npsScore > 0 ? `+${item.npsScore}` : `${item.npsScore}`;
          const barWidth = Math.max(Math.round((item.count / maxSetorCount) * 100), 4);

          return `
            <tr>
              <td style="padding: 7px 10px; font-size: 13px; font-weight: 700; color: #1e293b; width: 170px; text-align: left; vertical-align: middle;">
                📍 ${item.setor}
              </td>
              <td style="padding: 7px 10px; vertical-align: middle;">
                <div style="background-color: #f1f5f9; border-radius: 6px; overflow: hidden; height: 18px; width: 100%;">
                  <div style="background-color: ${barColor}; width: ${barWidth}%; height: 18px; border-radius: 6px;"></div>
                </div>
              </td>
              <td style="padding: 7px 10px; font-size: 12px; font-weight: 600; color: #475569; width: 185px; text-align: right; white-space: nowrap; vertical-align: middle;">
                ${item.count} ${item.count === 1 ? 'pessoa' : 'pessoas'} (${item.pct}%)
                <span style="display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 12px; background-color: #f8fafc; color: ${barColor}; border: 1px solid #e2e8f0;">
                  NPS ${npsFormatted}
                </span>
              </td>
            </tr>
          `;
        })
        .join('');

  // Cards de comentários dos usuários
  let comentariosHtml = '';
  if (data.comentarios.length === 0) {
    comentariosHtml = `
      <tr>
        <td style="padding: 24px; text-align: center; color: #64748b; font-size: 14px; background: #f8fafc; border-radius: 12px;">
          Nenhum comentário por escrito ou resposta detalhada foi registrado neste período.
        </td>
      </tr>
    `;
  } else {
    comentariosHtml = data.comentarios
      .map((c) => {
        let badgeColor = '#64748b';
        let badgeBg = '#f1f5f9';
        let badgeText = 'Avaliação Neutra';

        if (c.classificacao === 'promoter') {
          badgeColor = '#059669';
          badgeBg = '#d1fae5';
          badgeText = `Promotor (Nota ${c.npsScore ?? 10})`;
        } else if (c.classificacao === 'detractor') {
          badgeColor = '#dc2626';
          badgeBg = '#fee2e2';
          badgeText = `Detrator (Nota ${c.npsScore ?? 0})`;
        } else if (c.classificacao === 'neutral') {
          badgeColor = '#d97706';
          badgeBg = '#fef3c7';
          badgeText = `Neutro (Nota ${c.npsScore ?? 7})`;
        }

        let feedbackItems = '';

        if (c.feedbackPositivo) {
          feedbackItems += `
            <div style="margin-top: 10px; padding: 10px 14px; background-color: #f0fdf4; border-left: 3px solid #10b981; border-radius: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">
                👍 O que mais gostou:
              </span>
              <span style="font-size: 13px; color: #1e293b; line-height: 1.5; font-style: italic;">
                "${c.feedbackPositivo}"
              </span>
            </div>
          `;
        }

        if (c.feedbackNegativo) {
          feedbackItems += `
            <div style="margin-top: 10px; padding: 10px 14px; background-color: #fff1f2; border-left: 3px solid #f43f5e; border-radius: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: #be123c; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">
                💡 O que podemos melhorar:
              </span>
              <span style="font-size: 13px; color: #1e293b; line-height: 1.5; font-style: italic;">
                "${c.feedbackNegativo}"
              </span>
            </div>
          `;
        }

        if (c.duvida) {
          feedbackItems += `
            <div style="margin-top: 10px; padding: 10px 14px; background-color: #f8fafc; border-left: 3px solid #64748b; border-radius: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">
                📝 Dúvidas / Observações:
              </span>
              <span style="font-size: 13px; color: #1e293b; line-height: 1.5;">
                "${c.duvida}"
              </span>
            </div>
          `;
        }

        return `
          <tr>
            <td style="padding-bottom: 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <strong style="font-size: 14px; color: #0f172a; display: block;">${c.nome}</strong>
                          <span style="font-size: 12px; color: #64748b;">${c.dataHora}</span>
                        </td>
                        <td style="text-align: right; vertical-align: top;">
                          <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 20px; background-color: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; margin-bottom: 4px; margin-right: 4px;">
                            📍 ${c.setor}
                          </span>
                          <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 20px; background-color: ${badgeBg}; color: ${badgeColor}; margin-bottom: 4px;">
                            ${badgeText}
                          </span>
                        </td>
                      </tr>
                    </table>
                    ${feedbackItems}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Indicadores NPS - Hospital Santa Casa</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Cabeçalho Institucional -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px; text-align: center;">
              <img src="${LOGO_URL}" alt="Hospital Santa Casa" height="54" style="height: 54px; width: auto; display: block; margin: 0 auto 16px auto;" />
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                Relatório de Pesquisa NPS
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 14px; font-weight: 500;">
                Hospital Santa Casa de Misericórdia de Araguari
              </p>
            </td>
          </tr>

          <!-- Faixa de Período e Metadados -->
          <tr>
            <td style="background-color: #f8fafc; padding: 14px 32px; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 13px; color: #475569; font-weight: 600;">
                    📅 Período: <span style="color: #0f172a; font-weight: 700;">${data.periodoLabel}</span>
                  </td>
                  <td style="font-size: 12px; color: #64748b; text-align: right;">
                    Emitido em: ${data.dataGeracao}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do Relatório -->
          <tr>
            <td style="padding: 32px;">

              <!-- Bloco Hero: NPS Score + Total de Pesquisas Respondidas -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <!-- Card 1: NPS SCORE -->
                  <td width="49%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px 20px; text-align: center; vertical-align: top;">
                    <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
                      Pontuação Geral NPS
                    </span>
                    <div style="font-size: 50px; font-weight: 900; color: #0f172a; line-height: 1; letter-spacing: -2px; margin-bottom: 12px;">
                      ${scoreFormatted}
                    </div>
                    <span style="display: inline-block; padding: 5px 14px; font-size: 11px; font-weight: 800; border-radius: 20px; background-color: ${zoneBg}; color: ${zoneColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${zoneLabel}
                    </span>
                    <p style="margin: 12px 0 0 0; color: #64748b; font-size: 12px; line-height: 1.4;">
                      Índice de recomendação institucional (-100 a +100)
                    </p>
                  </td>

                  <td width="2%"></td>

                  <!-- Card 2: TOTAL DE PESQUISAS RESPONDIDAS -->
                  <td width="49%" style="background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%); border: 1px solid #bbf7d0; border-radius: 16px; padding: 24px 20px; text-align: center; vertical-align: top;">
                    <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
                      Pesquisas Respondidas
                    </span>
                    <div style="font-size: 50px; font-weight: 900; color: #166534; line-height: 1; letter-spacing: -2px; margin-bottom: 12px;">
                      ${data.totalRespondentes}
                    </div>
                    <span style="display: inline-block; padding: 5px 14px; font-size: 11px; font-weight: 800; border-radius: 20px; background-color: #dcfce7; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${data.totalRespondentes} ${data.totalRespondentes === 1 ? 'pessoa participante' : 'pessoas participantes'}
                    </span>
                    <p style="margin: 12px 0 0 0; color: #475569; font-size: 12px; line-height: 1.4;">
                      Total de pessoas que responderam à pesquisa no período
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Grid de Indicadores (Promotores, Neutros, Detratores) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <!-- Promotores -->
                  <td width="32%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center;">
                    <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; display: block; margin-bottom: 4px;">
                      Promotores (9-10)
                    </span>
                    <div style="font-size: 26px; font-weight: 800; color: #166534; line-height: 1.1;">
                      ${data.promotoresPct}%
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: #15803d; margin-top: 4px; display: block;">
                      ${data.promotoresCount} ${data.promotoresCount === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  </td>
                  <td width="2%"></td>
                  <!-- Neutros -->
                  <td width="32%" style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 16px; text-align: center;">
                    <span style="font-size: 11px; font-weight: 700; color: #a16207; text-transform: uppercase; display: block; margin-bottom: 4px;">
                      Neutros (7-8)
                    </span>
                    <div style="font-size: 26px; font-weight: 800; color: #854d0e; line-height: 1.1;">
                      ${data.neutrosPct}%
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: #a16207; margin-top: 4px; display: block;">
                      ${data.neutrosCount} ${data.neutrosCount === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  </td>
                  <td width="2%"></td>
                  <!-- Detratores -->
                  <td width="32%" style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; text-align: center;">
                    <span style="font-size: 11px; font-weight: 700; color: #be123c; text-transform: uppercase; display: block; margin-bottom: 4px;">
                      Detratores (0-6)
                    </span>
                    <div style="font-size: 26px; font-weight: 800; color: #9f1239; line-height: 1.1;">
                      ${data.detratoresPct}%
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: #be123c; margin-top: 4px; display: block;">
                      ${data.detratoresCount} ${data.detratoresCount === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Barra Visual Proporcional de NPS -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px;">
                      Distribuição Percentual da Base
                    </div>
                    <div style="background-color: #e2e8f0; border-radius: 8px; overflow: hidden; height: 16px; width: 100%;">
                      <table width="100%" height="16" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                        <tr>
                          <td width="${Math.max(data.promotoresPct, 1)}%" style="background-color: #10b981;"></td>
                          <td width="${Math.max(data.neutrosPct, 1)}%" style="background-color: #f59e0b;"></td>
                          <td width="${Math.max(data.detratoresPct, 1)}%" style="background-color: #ef4444;"></td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Cards Auxiliares: Equipe e Atendimento Geral -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td width="49%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">
                      Equipe Multiprofissional
                    </span>
                    <div style="font-size: 22px; font-weight: 800; color: #0f172a;">
                      ${data.mediaEquipe !== null ? `${data.mediaEquipe} ★` : 'N/A'}
                    </div>
                    <span style="font-size: 12px; color: #64748b;">Escala de 1 a 5 estrelas</span>
                  </td>
                  <td width="2%"></td>
                  <td width="49%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">
                      Atendimento Geral
                    </span>
                    <div style="font-size: 22px; font-weight: 800; color: #0f172a;">
                      ${data.mediaGeral !== null ? `${data.mediaGeral} ★` : 'N/A'}
                    </div>
                    <span style="font-size: 12px; color: #64748b;">Escala de 1 a 5 estrelas</span>
                  </td>
                </tr>
              </table>

              <!-- Detalhamento de Respostas por Nota (0 a 10) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
                      📊 Frequência por Nota Recomendada (0 a 10)
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                      ${distribuicaoRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Totalização e Avaliações por Setor -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
                      🏥 Totalização e Avaliações por Setor (${data.distribuicaoSetores.length})
                    </h3>
                    <p style="margin: 4px 0 12px 0; font-size: 12px; color: #64748b;">
                      Volume de pessoas atendidas e índice de satisfação NPS correspondente em cada área.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                      ${distribuicaoSetoresRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Seção de Feedbacks e Comentários das Pessoas -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
                      💬 Feedbacks e Comentários das Pessoas (${data.comentarios.length})
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${comentariosHtml}
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: center; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">
                Hospital Santa Casa de Misericórdia de Araguari
              </p>
              <p style="margin: 0; color: #64748b; font-size: 11px;">
                Relatório gerado automaticamente através do Módulo de Gestão NPS.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispara o relatório gerado por e-mail chamando a Edge Function do Supabase
 */
export async function sendNpsReportEmail(params: {
  to: string | string[];
  startDate: string;
  endDate: string;
  periodoLabel: string;
  customSubject?: string;
}): Promise<SendNpsReportResponse> {
  try {
    // 1. Compila os dados analíticos
    const reportData = await fetchNpsReportData({
      startDate: params.startDate,
      endDate: params.endDate,
      periodoLabel: params.periodoLabel
    });

    // 2. Constrói o HTML oficial
    const html = buildNpsReportHtml(reportData);

    // 3. Invoca a Edge Function
    const { data, error } = await supabase.functions.invoke('send-nps-report-email', {
      body: {
        to: params.to,
        subject: params.customSubject,
        periodoReferencia: params.periodoLabel,
        html
      }
    });

    if (error) {
      console.error('[NPS Email Service] Erro ao invocar função:', error);
      let errMsg = error.message || 'Falha ao conectar com o serviço de envio de e-mails.';
      try {
        if ((error as any).context) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) errMsg = bodyJson.error;
        }
      } catch (_) {}
      return { success: false, error: errMsg };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      recipientsCount: data?.recipientsCount,
      recipients: data?.recipients
    };
  } catch (err: any) {
    console.error('[NPS Email Service] Exceção:', err);
    return {
      success: false,
      error: err.message || 'Erro inesperado ao gerar e enviar o relatório por e-mail.'
    };
  }
}
