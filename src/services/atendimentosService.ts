// src/services/atendimentosService.ts
// Serviço para consulta e normalização de atendimentos da Diretoria via n8n / Tasy Oracle

export interface ConvenioResumo {
  dsConvenio: string;
  qtde: number;
  percentual: number;
  categoria: 'SUS' | 'Privado' | 'Particular' | 'Outros';
  ordem: number;
}

export interface EvolucaoMensalAtendimento {
  mes: number;
  mesNome: string;
  total: number;
  sus: number;
  naoSus: number;
  clinica: number;
  ipsemg: number;
  susClinica: number;
  totalClinica: number;
  mediaDiaria: number;
  porTurno6h: number;
}

export interface FiltrosAtendimentos {
  dtInicio?: string;
  dtFim?: string;
  setor?: string;
  convenio?: string;
  tipoAtendimento?: string;
  clinica?: string | number;
  busca?: string;
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
  evolucaoMensal: EvolucaoMensalAtendimento[];
  isMock: boolean;
  dataAtualizacao: string;
}

// ── Domínios Reais do Tasy Oracle ──────────────────────────────────────────

export const OPCOES_CONVENIOS = [
  { cd: '1', ds: 'Particular' },
  { cd: '4', ds: 'SUS - Sistema Único de Saúde' },
  { cd: '7', ds: 'Unimed' },
  { cd: '8', ds: 'Fusex' },
  { cd: '9', ds: 'Saúde Caixa' },
  { cd: '10', ds: 'IPSM' },
  { cd: '11', ds: 'IPSEMG' },
  { cd: '12', ds: 'Cemig Saúde' },
  { cd: '13', ds: 'Hap Vida' },
  { cd: '14', ds: 'Notre Dame' },
  { cd: '15', ds: 'Conservador 009/22' },
  { cd: '16', ds: 'Particular 01' },
  { cd: '17', ds: 'PMA Convênio 009/21' },
  { cd: '18', ds: 'Convênio Indianópolis' },
  { cd: '19', ds: 'Convênio Prata' },
  { cd: '20', ds: 'Convênio Cascalho Rico' },
  { cd: '21', ds: 'Cortesia' },
  { cd: '24', ds: 'Cartão Santo Antônio' },
  { cd: '25', ds: 'CISTM / SUS' },
  { cd: '26', ds: 'Instituto Nefrológico' },
  { cd: '27', ds: 'Projeto Miguilim' },
  { cd: '28', ds: 'Select Saúde' },
  { cd: '29', ds: 'DORACI Centro de Nefrologia e diálise' },
  { cd: '30', ds: 'Brasil Med Saúde Ltda' },
  { cd: '31', ds: 'CASSI' },
  { cd: '32', ds: 'SulAmérica' }
];

export const OPCOES_SETORES = [
  { cd: '109', ds: 'Ambulatório Geral' },
  { cd: '121', ds: 'Biópsia' },
  { cd: '122', ds: 'Canguru' },
  { cd: '116', ds: 'Catarata' },
  { cd: '105', ds: 'Colonoscopia/Endoscopia' },
  { cd: '90', ds: 'Farmácia CC' },
  { cd: '86', ds: 'Farmácia Central' },
  { cd: '91', ds: 'Faturamento' },
  { cd: '124', ds: 'Intermediários' },
  { cd: '81', ds: 'Posto 1' },
  { cd: '82', ds: 'Posto 2 - Apartamentos' },
  { cd: '110', ds: 'Posto 2 - Apartamentos RN' },
  { cd: '103', ds: 'Posto 2 - G.O' },
  { cd: '100', ds: 'Posto 2 - G.O RN' },
  { cd: '69', ds: 'Posto 3' },
  { cd: '102', ds: 'Posto 3 - RN' },
  { cd: '84', ds: 'Posto 4' },
  { cd: '85', ds: 'Posto 5/ Pediatria' },
  { cd: '87', ds: 'Posto 6' },
  { cd: '99', ds: 'Pré Internação P.A' },
  { cd: '96', ds: 'Pronto Atendimento' },
  { cd: '92', ds: 'Recepção e Portaria' },
  { cd: '113', ds: 'Tratamento Conservador' },
  { cd: '95', ds: 'UTI Neonatal' },
  { cd: '93', ds: 'UTI Unidade 1' },
  { cd: '94', ds: 'UTI Unidade 2' }
];

export const OPCOES_CLINICAS = [
  { cd: '17', ds: 'Cardiologia' },
  { cd: '1', ds: 'Cirúrgica' },
  { cd: '3', ds: 'Clínica Médica' },
  { cd: '6', ds: 'Consulta Ambulatorial' },
  { cd: '57', ds: 'Exames' },
  { cd: '2', ds: 'Ginecologia e Obstetrícia' },
  { cd: '33', ds: 'Laboratórios' },
  { cd: '200', ds: 'Ortopedia' },
  { cd: '7', ds: 'Pediatria' },
  { cd: '4', ds: 'Pediátrica' },
  { cd: '5', ds: 'Psiquiátrica' },
  { cd: '87', ds: 'Psiquiátrica' },
  { cd: '10', ds: 'SAS' }
];

export const OPCOES_TIPOS_ATENDIMENTO = [
  { cd: '8', ds: 'Ambulatorial' },
  { cd: '6', ds: 'Atendimento domiciliar' },
  { cd: '25', ds: 'Caso urgente' },
  { cd: '7', ds: 'Externo' },
  { cd: '1', ds: 'Internado' },
  { cd: '3', ds: 'Pronto socorro' },
  { cd: '26', ds: 'Remoção' },
  { cd: '21', ds: 'Telessaúde' }
];

export function classificarCategoriaConvenio(nome: string): 'SUS' | 'Privado' | 'Particular' | 'Outros' {
  const n = (nome || '').toUpperCase().trim();
  // Apenas o SUS oficial (Sistema Único de Saúde)
  if (n.includes('SUS') || n.includes('SISTEMA ÚNICO') || n.includes('SISTEMA UNICO')) {
    return 'SUS';
  }
  // Atendimentos particulares diretos
  if (n.includes('PARTICULAR') || n.includes('DIRETO')) {
    return 'Particular';
  }
  if (!n || n === 'TOTAL' || n === 'OUTROS') {
    return 'Outros';
  }
  return 'Privado';
}

// ── Gerador de Dados de Demonstração (Fallback se offline) ─────────────────
export function gerarDadosDemonstracao(filtros: FiltrosAtendimentos = {}): ConvenioResumo[] {
  const mockBase = [
    { dsConvenio: 'SUS - Sistema Único de Saúde', qtde: 486 },
    { dsConvenio: 'Unimed', qtde: 249 },
    { dsConvenio: 'IPSEMG', qtde: 98 },
    { dsConvenio: 'Notre Dame', qtde: 50 },
    { dsConvenio: 'Particular', qtde: 37 },
    { dsConvenio: 'Fusex', qtde: 27 },
    { dsConvenio: 'Conservador 009/22', qtde: 25 },
    { dsConvenio: 'Cemig Saúde', qtde: 9 },
    { dsConvenio: 'IPSM', qtde: 6 },
    { dsConvenio: 'SulAmérica', qtde: 6 },
    { dsConvenio: 'Projeto Miguilim', qtde: 5 },
    { dsConvenio: 'Cortesia', qtde: 3 },
    { dsConvenio: 'Cartão Santo Antônio', qtde: 2 },
    { dsConvenio: 'CASSI', qtde: 1 },
    { dsConvenio: 'Hap Vida', qtde: 1 },
    { dsConvenio: 'Saúde Caixa', qtde: 1 }
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

// Função para calcular produtividade assistencial com fórmulas reais
export function calcularProdutividadeMensal(mes: number, totalClinica: number, ano: number = 2026): { mediaDiaria: number; porTurno6h: number } {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const mediaDiaria = diasNoMes > 0 ? Math.round(totalClinica / diasNoMes) : 0;
  const porTurno6h = Math.round(mediaDiaria / 3);
  return { mediaDiaria, porTurno6h };
}

// Formata e normaliza registro de evolução mensal vindo do Oracle / n8n
export function formatarLinhaEvolucaoMensal(raw: any, ano: number = 2026): EvolucaoMensalAtendimento {
  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mesNum = Number(raw.MES ?? raw.mes ?? 1);
  const mesNome = raw.MES_NOME ?? raw.mesNome ?? mesesNomes[mesNum - 1] ?? `Mês ${mesNum}`;
  const total = Number(raw.TOTAL ?? raw.total ?? 0);
  const sus = Number(raw.SUS ?? raw.sus ?? 0);
  const naoSus = Number(raw.NAO_SUS ?? raw.naoSus ?? (total - sus));
  const clinica = Number(raw.CLINICA ?? raw.clinica ?? 0);
  const ipsemg = Number(raw.IPSEMG ?? raw.ipsemg ?? 0);
  const susClinica = Number(raw.SUS_CLINICA ?? raw.susClinica ?? 0);
  const totalClinica = Number(raw.TOTAL_CLINICA ?? raw.totalClinica ?? clinica);

  // Fórmula: Média Diária = Total Clínica / Quantidade de Dias do Mês
  const diasNoMes = Number(raw.QTD_DIAS ?? raw.qtdDias ?? new Date(ano, mesNum, 0).getDate());
  const mediaDiariaCalc = diasNoMes > 0 ? Math.round(totalClinica / diasNoMes) : 0;
  const mediaDiaria = raw.MEDIA_DIARIA !== undefined ? Number(raw.MEDIA_DIARIA) : mediaDiariaCalc;

  // Fórmula: Por Turno = Média Diária / 3
  const porTurnoCalc = Math.round(mediaDiaria / 3);
  const porTurno6h = raw.POR_TURNO_6H !== undefined ? Number(raw.POR_TURNO_6H) : (raw.POR_TURNO !== undefined ? Number(raw.POR_TURNO) : porTurnoCalc);

  return {
    mes: mesNum,
    mesNome,
    total,
    sus,
    naoSus,
    clinica,
    ipsemg,
    susClinica,
    totalClinica,
    mediaDiaria,
    porTurno6h
  };
}

// Dados de evolução mensal com aplicação rigorosa das fórmulas (totalClinica / dias e media / 3)
export function gerarDadosEvolucaoMensal(ano: number = 2026): EvolucaoMensalAtendimento[] {
  const baseBruta = [
    { mes: 1, total: 2288, sus: 515, naoSus: 1773, clinica: 1013, ipsemg: 269, susClinica: 26, totalClinica: 718 },
    { mes: 2, total: 2333, sus: 412, naoSus: 1921, clinica: 1171, ipsemg: 257, susClinica: 14, totalClinica: 900 },
    { mes: 3, total: 3304, sus: 545, naoSus: 2759, clinica: 1771, ipsemg: 471, susClinica: 32, totalClinica: 1268 },
    { mes: 4, total: 3485, sus: 580, naoSus: 2905, clinica: 1860, ipsemg: 473, susClinica: 37, totalClinica: 1350 },
    { mes: 5, total: 3217, sus: 475, naoSus: 2742, clinica: 1769, ipsemg: 445, susClinica: 17, totalClinica: 1307 },
    { mes: 6, total: 3037, sus: 531, naoSus: 2506, clinica: 1503, ipsemg: 352, susClinica: 29, totalClinica: 1122 },
    { mes: 7, total: 2855, sus: 546, naoSus: 2309, clinica: 1444, ipsemg: 345, susClinica: 34, totalClinica: 1065 },
    { mes: 8, total: 2543, sus: 534, naoSus: 2009, clinica: 1216, ipsemg: 305, susClinica: 28, totalClinica: 883 }
  ];

  return baseBruta.map(item => formatarLinhaEvolucaoMensal(item, ano));
}

// ── Cache em Memória e Controle de Concorrência ─────────────────────────────
const cacheAtendimentos = new Map<string, { timestamp: number; data: AtendimentosDiretoriaResponse }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos de cache
let controllerAtivo: AbortController | null = null;

// ── Serviço Principal de Atendimentos ───────────────────────────────────────
export const atendimentosService = {
  /**
   * Consulta os atendimentos no webhook do n8n / Tasy Oracle com Cache e Proteção de Concorrência
   */
  async buscarAtendimentos(
    filtros: FiltrosAtendimentos = {},
    ignorarCache: boolean = false
  ): Promise<AtendimentosDiretoriaResponse> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_ATENDIMENTOS || 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_atendimentos_dir';

    const cacheKey = JSON.stringify({
      ini: filtros.dtInicio || 'default_ini',
      fim: filtros.dtFim || 'default_fim',
      conv: filtros.convenio || '0',
      setor: filtros.setor || '0',
      clin: filtros.clinica || 0,
      tipo: filtros.tipoAtendimento || '0'
    });

    // 1. Retorno instantâneo do cache se válido
    if (!ignorarCache && cacheAtendimentos.has(cacheKey)) {
      const cached = cacheAtendimentos.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return {
          ...cached.data,
          dataAtualizacao: cached.data.dataAtualizacao
        };
      }
    }

    // 2. Cancela qualquer requisição anterior que ainda estiver rodando no n8n
    if (controllerAtivo) {
      try {
        controllerAtivo.abort();
      } catch {
        // ignora
      }
    }

    controllerAtivo = new AbortController();
    const controller = controllerAtivo;
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout para queries pesadas

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

      const cdConvenioVal = filtros.convenio && filtros.convenio !== '0' ? String(filtros.convenio) : '0';
      const cdSetorVal = filtros.setor && filtros.setor !== '0' ? String(filtros.setor) : '0';
      const cdClinicaVal = filtros.clinica && filtros.clinica !== '0' ? Number(filtros.clinica) : 0;
      const ieTipoVal = filtros.tipoAtendimento && filtros.tipoAtendimento !== '0' ? String(filtros.tipoAtendimento) : '0';

      const dtInicioOracle = formatarDataOracle(filtros.dtInicio) || '01/10/2026';
      const dtFimOracle = formatarDataOracle(filtros.dtFim) || '07/10/2026';

      const payload = {
        dt_inicial: dtInicioOracle,
        dt_final: dtFimOracle,
        cd_convenio: cdConvenioVal,
        cd_setor_atendimento: cdSetorVal,
        cd_clinica: cdClinicaVal,
        IE_TIPO_ATENDIMENTO: ieTipoVal,

        // Compatibilidade com nós que usam bind com :
        ":dt_inicial": dtInicioOracle,
        ":dt_final": dtFimOracle,
        ":cd_convenio": cdConvenioVal,
        ":cd_setor_atendimento": cdSetorVal,
        ":cd_clinica": cdClinicaVal,
        ":IE_TIPO_ATENDIMENTO": ieTipoVal
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
        console.warn('[atendimentosService] Webhook retornou corpo vazio.');
        return this.processarRespostaEmMemoria([], false, 0);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.warn('[atendimentosService] Resposta não é JSON válido:', text);
        return this.processarRespostaEmMemoria(gerarDadosDemonstracao(filtros), true);
      }

      // 1. Extrair lista de convênios (suporta { convenios: [...] }, { data: [...] } ou array direto)
      let rawConvenios: any[] = [];
      if (Array.isArray(parsed)) {
        rawConvenios = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.convenios)) rawConvenios = parsed.convenios;
        else if (Array.isArray(parsed.data)) rawConvenios = parsed.data;
        else if (Array.isArray(parsed.rows)) rawConvenios = parsed.rows;
        else if (Array.isArray(parsed.items)) rawConvenios = parsed.items;
        else if (Array.isArray(parsed.result)) rawConvenios = parsed.result;
        else if (Array.isArray(parsed.json?.convenios)) rawConvenios = parsed.json.convenios;
        else rawConvenios = [parsed];
      }

      // Desempacota itens encapsulados por { json: { ... } } pelo n8n
      const unwrappedConvenios = rawConvenios.map(item => (item && typeof item === 'object' && item.json ? item.json : item));

      // 2. Extrair evolução mensal (suporta { evolucao_mensal: [...] } ou chave mensal)
      const rawMensal = parsed?.evolucao_mensal || parsed?.evolucaoMensal || parsed?.mensal || parsed?.json?.evolucao_mensal || [];
      const unwrappedMensal = Array.isArray(rawMensal)
        ? rawMensal.map((m: any) => (m && typeof m === 'object' && m.json ? m.json : m))
        : [];

      // 3. Processar registros do SQL agrupado por convênio
      const conveniosProcessados: ConvenioResumo[] = [];
      const mapaMensal = new Map<number, EvolucaoMensalAtendimento>();
      let totalCapturadoOracle: number | null = null;

      // Processar evolução mensal se presente
      unwrappedMensal.forEach((mRow: any) => {
        const itemFormatado = formatarLinhaEvolucaoMensal(mRow);
        if (itemFormatado && itemFormatado.mes) {
          mapaMensal.set(itemFormatado.mes, itemFormatado);
        }
      });

      unwrappedConvenios.forEach((row: any) => {
        // Se a linha for um registro de mês (caso venha misturado)
        if (row.MES !== undefined || row.mes !== undefined) {
          const mItem = formatarLinhaEvolucaoMensal(row);
          if (mItem && mItem.mes) mapaMensal.set(mItem.mes, mItem);
          return;
        }

        const convenioNome = String(row.DS_CONVENIO || row.ds_convenio || row.CONVENIO || row.convenio || '').trim();
        const quantidade = Number(row.QTDE ?? row.qtde ?? row.QUANTIDADE ?? row.quantidade ?? 0);
        const ordem = Number(row.ORDEM ?? row.ordem ?? 1);

        // Se for linha de TOTAL (ORDEM 3 ou nome TOTAL)
        if (convenioNome.toUpperCase() === 'TOTAL' || ordem === 3) {
          if (!isNaN(quantidade)) {
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
            percentual: 0,
            categoria: classificarCategoriaConvenio(convenioNome),
            ordem: ordem
          });
        }
      });

      const evolucaoMensalFinal = Array.from(mapaMensal.values()).sort((a, b) => a.mes - b.mes);

      const respostaFinal = this.processarRespostaEmMemoria(
        conveniosProcessados,
        false,
        totalCapturadoOracle,
        evolucaoMensalFinal.length > 0 ? evolucaoMensalFinal : undefined
      );

      cacheAtendimentos.set(cacheKey, {
        timestamp: Date.now(),
        data: respostaFinal
      });

      return respostaFinal;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn('[atendimentosService] Falha ao consultar webhook do n8n. Usando fallback demonstrativo:', error.message);
      return this.processarRespostaEmMemoria(gerarDadosDemonstracao(filtros), true);
    }
  },

  /**
   * Consolida indicadores, totais e percentuais
   */
  processarRespostaEmMemoria(
    convenios: ConvenioResumo[],
    isMock: boolean,
    totalForcadoOracle?: number | null,
    evolucaoMensalVindaDoBanco?: EvolucaoMensalAtendimento[]
  ): AtendimentosDiretoriaResponse {
    // Ordenar do maior para o menor volume
    const conveniosOrdenados = [...convenios].sort((a, b) => b.qtde - a.qtde);

    // Calcular soma real
    const somaItens = conveniosOrdenados.reduce((acc, c) => acc + c.qtde, 0);
    const totalGeral = totalForcadoOracle !== null && totalForcadoOracle !== undefined ? totalForcadoOracle : somaItens;

    let totalSus = 0;
    let totalParticular = 0;
    let totalPrivado = 0;

    conveniosOrdenados.forEach(c => {
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
      evolucaoMensal: (evolucaoMensalVindaDoBanco && evolucaoMensalVindaDoBanco.length > 0)
        ? evolucaoMensalVindaDoBanco
        : gerarDadosEvolucaoMensal(),
      isMock,
      dataAtualizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  }
};
