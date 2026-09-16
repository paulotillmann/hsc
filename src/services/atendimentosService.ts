// src/services/atendimentosService.ts
// Serviço para consulta e normalização de atendimentos da Diretoria via n8n / Tasy

export interface ConvenioResumo {
  dsConvenio: string;
  qtde: number;
  percentual: number;
  categoria: 'SUS' | 'Privado' | 'Particular' | 'Outros';
  ordem: number;
}

export interface AtendimentoTasy {
  id: string;
  nrAtendimento: number | string;
  nmPaciente: string;
  dtEntrada: string;
  dtAlta?: string | null;
  dsSetor: string;
  dsConvenio: string;
  nmMedico?: string | null;
  tipoAtendimento: string;
  status: string;
  tempoPermanenciaMinutos?: number;
  idade?: number | null;
  sexo?: 'M' | 'F' | string;
  dsDiagnostico?: string | null;
  vlConta?: number | null;
}

export interface FiltrosAtendimentos {
  dtInicio?: string;
  dtFim?: string;
  setor?: string;
  convenio?: string;
  tipoAtendimento?: string;
  status?: string;
  busca?: string;
  clinica?: string | number;
}

export interface AtendimentosDiretoriaResponse {
  convenios: ConvenioResumo[];
  totalGeral: number;
  totalSus: number;
  percentualSus: number;
  totalPrivado: number;
  percentualPrivado: number;
  totalParticular: number;
  percentualParticular: number;
  totalOperadoras: number;
  topConvenio?: ConvenioResumo;
  isMock: boolean;
  dataAtualizacao: string;
}

export function formatarMinutosParaTexto(minutos: number): string {
  if (!minutos || minutos <= 0) return '0 min';
  const horas = Math.floor(minutos / 60);
  const minRestantes = minutos % 60;
  if (horas === 0) return `${minRestantes} min`;
  if (minRestantes === 0) return `${horas}h`;
  return `${horas}h ${minRestantes}m`;
}

export function classificarCategoriaConvenio(nome: string): 'SUS' | 'Privado' | 'Particular' | 'Outros' {
  const n = (nome || '').toUpperCase().trim();
  if (n.includes('SUS') || n.includes('SISTEMA ÚNICO') || n.includes('SISTEMA UNICO')) {
    return 'SUS';
  }
  if (n.includes('PARTICULAR') || n.includes('DIRETO')) {
    return 'Particular';
  }
  if (!n || n === 'TOTAL' || n === 'OUTROS') {
    return 'Outros';
  }
  return 'Privado';
}

// ── Gerador de Dados de Demonstração / Fallback Realista ────────────────────
export function gerarDadosDemonstracao(): ConvenioResumo[] {
  const mockBase = [
    { dsConvenio: 'SUS - Sistema Único de Saúde', qtde: 18357 },
    { dsConvenio: 'Unimed', qtde: 11291 },
    { dsConvenio: 'IPSEMG', qtde: 3870 },
    { dsConvenio: 'Particular', qtde: 1878 },
    { dsConvenio: 'Notre Dame Intermédica', qtde: 1420 },
    { dsConvenio: 'Bradesco Saúde', qtde: 1150 },
    { dsConvenio: 'Sulamérica Saúde', qtde: 980 },
    { dsConvenio: 'Amil Assistência Médica', qtde: 820 },
    { dsConvenio: 'CASSI', qtde: 540 },
    { dsConvenio: 'Golden Cross', qtde: 410 },
    { dsConvenio: 'Brasil Med Saúde Ltda', qtde: 330 },
    { dsConvenio: 'Allianz Saúde', qtde: 290 },
    { dsConvenio: 'Porto Seguro Saúde', qtde: 260 },
    { dsConvenio: 'Fundação Copel', qtde: 220 },
    { dsConvenio: 'Postal Saúde', qtde: 190 },
    { dsConvenio: 'Geap Saúde', qtde: 180 },
    { dsConvenio: 'Sanitas Assistência Médica', qtde: 150 },
    { dsConvenio: 'Mediservice', qtde: 130 },
    { dsConvenio: 'Life Empresarial Saúde', qtde: 110 },
    { dsConvenio: 'Vivest', qtde: 90 }
  ];

  const total = mockBase.reduce((acc, curr) => acc + curr.qtde, 0);

  return mockBase.map(item => ({
    dsConvenio: item.dsConvenio,
    qtde: item.qtde,
    percentual: total > 0 ? Number(((item.qtde / total) * 100).toFixed(2)) : 0,
    categoria: classificarCategoriaConvenio(item.dsConvenio),
    ordem: 1
  }));
}

// ── Serviço Principal de Atendimentos ───────────────────────────────────────
export const atendimentosService = {
  /**
   * Consulta os atendimentos no webhook do n8n / Tasy Oracle
   */
  async buscarAtendimentos(filtros: FiltrosAtendimentos = {}): Promise<AtendimentosDiretoriaResponse> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_ATENDIMENTOS || 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_atendimentos_dir';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 segundos timeout

    try {
      if (!webhookUrl) {
        throw new Error('Webhook URL não configurada.');
      }

      // Converte data ISO (YYYY-MM-DD) para formato aceito no Oracle Tasy (DD/MM/YYYY)
      const formatarDataOracle = (dataIso?: string) => {
        if (!dataIso) return null;
        const partes = dataIso.split('-');
        if (partes.length === 3) {
          const [ano, mes, dia] = partes;
          return `${dia}/${mes}/${ano}`;
        }
        return dataIso;
      };

      const payload = {
        // Binds exatos do script SQL Oracle Tasy
        dt_inicial: formatarDataOracle(filtros.dtInicio) || null,
        dt_final: formatarDataOracle(filtros.dtFim) || null,
        cd_convenio: filtros.convenio && filtros.convenio !== 'todos' ? filtros.convenio : '0',
        cd_setor_atendimento: filtros.setor && filtros.setor !== 'todos' ? filtros.setor : '0',
        cd_clinica: filtros.clinica && filtros.clinica !== '0' ? Number(filtros.clinica) || 0 : 0,
        IE_TIPO_ATENDIMENTO: filtros.tipoAtendimento && filtros.tipoAtendimento !== 'todos' ? filtros.tipoAtendimento : '0',

        // Parâmetros em formato padrão ISO para compatibilidade no n8n
        dt_inicio: filtros.dtInicio || null,
        dt_fim: filtros.dtFim || null,
        setor: filtros.setor || null,
        convenio: filtros.convenio || null,
        busca: filtros.busca || null
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro na resposta do webhook: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        console.warn('[atendimentosService] Webhook retornou corpo vazio. Carregando dados demonstrativos.');
        return this.processarRespostaEmMemoria(gerarDadosDemonstracao(), true);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.warn('[atendimentosService] Resposta não é JSON válido:', text);
        return this.processarRespostaEmMemoria(gerarDadosDemonstracao(), true);
      }

      let rawItems: any[] = [];
      if (Array.isArray(parsed)) {
        rawItems = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) rawItems = parsed.data;
        else if (Array.isArray(parsed.rows)) rawItems = parsed.rows;
        else if (Array.isArray(parsed.items)) rawItems = parsed.items;
        else if (Array.isArray(parsed.result)) rawItems = parsed.result;
        else rawItems = [parsed];
      }

      // Desempacota itens encapsulados por { json: { ... } } pelo n8n
      const unwrapped = rawItems.map(item => (item && typeof item === 'object' && item.json ? item.json : item));

      if (unwrapped.length === 0) {
        console.warn('[atendimentosService] Resposta vazia do webhook. Carregando dados demonstrativos.');
        return this.processarRespostaEmMemoria(gerarDadosDemonstracao(), true);
      }

      // Processar registros do SQL agrupado por convênio
      const conveniosProcessados: ConvenioResumo[] = [];
      let totalCapturadoOracle: number | null = null;

      unwrapped.forEach((row: any) => {
        const convenioNome = String(row.DS_CONVENIO || row.ds_convenio || row.CONVENIO || row.convenio || '').trim();
        const quantidade = Number(row.QTDE ?? row.qtde ?? row.QUANTIDADE ?? row.quantidade ?? 0);
        const ordem = Number(row.ORDEM ?? row.ordem ?? 1);

        // Se for linha de TOTAL (ORDEM 3 ou nome TOTAL)
        if (convenioNome.toUpperCase() === 'TOTAL' || ordem === 3) {
          if (!isNaN(quantidade) && quantidade > 0) {
            totalCapturadoOracle = quantidade;
          }
          return;
        }

        // Se for linha separadora vazia (ORDEM 2)
        if (!convenioNome || ordem === 2) {
          return;
        }

        // Convênio com quantidade
        if (quantidade >= 0) {
          conveniosProcessados.push({
            dsConvenio: convenioNome,
            qtde: quantidade,
            percentual: 0, // calculado a seguir
            categoria: classificarCategoriaConvenio(convenioNome),
            ordem: ordem
          });
        }
      });

      return this.processarRespostaEmMemoria(conveniosProcessados, false, totalCapturadoOracle);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn('[atendimentosService] Falha ao consultar webhook do n8n. Usando fallback:', error.message);
      return this.processarRespostaEmMemoria(gerarDadosDemonstracao(), true);
    }
  },

  /**
   * Consolida indicadores, totais e percentuais
   */
  processarRespostaEmMemoria(
    convenios: ConvenioResumo[],
    isMock: boolean,
    totalForcadoOracle?: number | null
  ): AtendimentosDiretoriaResponse {
    // Ordenar do maior para o menor volume
    const conveniosOrdenados = [...convenios].sort((a, b) => b.qtde - a.qtde);

    // Calcular soma real
    const somaItens = conveniosOrdenados.reduce((acc, c) => acc + c.qtde, 0);
    const totalGeral = totalForcadoOracle && totalForcadoOracle >= somaItens ? totalForcadoOracle : somaItens;

    let totalSus = 0;
    let totalParticular = 0;
    let totalPrivado = 0;

    conveniosOrdenados.forEach(c => {
      // Atribuir percentual proporcional
      c.percentual = totalGeral > 0 ? Number(((c.qtde / totalGeral) * 100).toFixed(2)) : 0;

      if (c.categoria === 'SUS') {
        totalSus += c.qtde;
      } else if (c.categoria === 'Particular') {
        totalParticular += c.qtde;
      } else {
        totalPrivado += c.qtde;
      }
    });

    const percentualSus = totalGeral > 0 ? Number(((totalSus / totalGeral) * 100).toFixed(1)) : 0;
    const percentualPrivado = totalGeral > 0 ? Number(((totalPrivado / totalGeral) * 100).toFixed(1)) : 0;
    const percentualParticular = totalGeral > 0 ? Number(((totalParticular / totalGeral) * 100).toFixed(1)) : 0;

    return {
      convenios: conveniosOrdenados,
      totalGeral,
      totalSus,
      percentualSus,
      totalPrivado,
      percentualPrivado,
      totalParticular,
      percentualParticular,
      totalOperadoras: conveniosOrdenados.length,
      topConvenio: conveniosOrdenados.length > 0 ? conveniosOrdenados[0] : undefined,
      isMock,
      dataAtualizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  }
};
