import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Database,
  MapPin,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ArrowUpDown,
  Building2,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Repeat,
  Flame,
  AlertOctagon,
  Printer,
  Lock,
  Monitor,
  Wifi,
  PhoneCall,
  Activity,
  Wrench,
  ShieldAlert,
  Laptop
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export interface OrdemServicoItem {
  id: string;
  nr_sequencia: number;
  ds_grupo_des: string | null;
  nr_seq_localizacao: number | null;
  ds_localizacao: string | null;
  nr_seq_equipamento: number | null;
  ds_equipamento: string | null;
  nm_solicitante: string | null;
  telefone_solicitante: string | null;
  nm_executor: string | null;
  nm_usuario_encer: string | null;
  nm_usuario: string | null;
  dt_ordem_servico: string | null;
  dt_atualizacao: string | null;
  minutos_atualiza: number | null;
  ds_estagio: string | null;
  ie_status_ordem: string | null;
  ie_prioridade: string | null;
  ds_prioridade: string | null;
  ie_parado: string | null;
  ds_dano_breve: string | null;
  ds_dano: string | null;
  nr_seq_estagio: number | null;
  ds_situacao: string | null;
  ds_solucao: string | null;
  ds_relat_tecnico: string | null;
  created_at: string;
  updated_at: string;
}

export type OSTypeCategory = 'Infraestrutura' | 'Sistemas';

/**
 * Classifica a Ordem de Serviço em Infraestrutura ou Sistemas
 * baseado no grupo de destino (ds_grupo_des) com fallback inteligente pela descrição.
 */
export function classifyOSType(os: OrdemServicoItem): OSTypeCategory {
  const grupo = (os.ds_grupo_des || '').toLowerCase().trim();

  // 1. Verificação por Grupo de Destino explícito
  if (
    grupo.includes('infra') ||
    grupo.includes('rede') ||
    grupo.includes('hardware') ||
    grupo.includes('telef') ||
    grupo.includes('suporte') ||
    grupo.includes('manuten')
  ) {
    return 'Infraestrutura';
  }

  if (
    grupo.includes('sist') ||
    grupo.includes('soft') ||
    grupo.includes('tasy') ||
    grupo.includes('banco') ||
    grupo.includes('desenv') ||
    grupo.includes('integra')
  ) {
    return 'Sistemas';
  }

  // 2. Fallback inteligente baseado em termos técnicos do dano ou equipamento
  const textoDano = `${os.ds_dano_breve || ''} ${os.ds_dano || ''} ${os.ds_equipamento || ''}`.toLowerCase();

  const infraKeywords = [
    'impressora', 'computador', 'pc', 'teclado', 'mouse', 'monitor', 'nobreak',
    'estabilizador', 'switch', 'roteador', 'cabo', 'rede', 'internet', 'wifi',
    'wi-fi', 'ponto', 'rack', 'tomada', 'formatar', 'formata', 'instalação',
    'instalar', 'ligar', 'travou', 'lento', 'bipando', 'tela azul', 'hd', 'ssd',
    'ramal', 'telefone', 'aparelho', 'toner', 'cartucho', 'scanner', 'leitor', 'hdmi'
  ];

  const sistemaKeywords = [
    'tasy', 'sistema', 'senha', 'login', 'acesso', 'permissão', 'bloqueado',
    'liberar', 'usuario', 'usuário', 'modulo', 'módulo', 'prescrição', 'evolução',
    'atendimento', 'prontuário', 'pep', 'relatório', 'bi', 'dashboard', 'painel',
    'formula', 'fórmula', 'calculo', 'cálculo', 'erro no tasy', 'glosa', 'faturamento'
  ];

  const hasInfra = infraKeywords.some(kw => textoDano.includes(kw));
  const hasSistema = sistemaKeywords.some(kw => textoDano.includes(kw));

  if (hasSistema && !hasInfra) return 'Sistemas';
  if (hasInfra && !hasSistema) return 'Infraestrutura';
  if (hasSistema) return 'Sistemas';

  // Padrão default
  return 'Infraestrutura';
}

function isOSFinalizada(os: OrdemServicoItem): boolean {
  const situacao = (os.ds_situacao || '').toLowerCase();
  const encer = (os.nm_usuario_encer || '').trim();
  const estagio = (os.ds_estagio || '').toLowerCase().trim();

  return (
    situacao.includes('finalizada') ||
    situacao.includes('finalizado') ||
    situacao.includes('encerrada') ||
    situacao.includes('concluída') ||
    situacao.includes('concluido') ||
    encer !== '' ||
    estagio.includes('encerrad')
  );
}

// ── Definições de Categorias de Assuntos Recorrentes por Dano ──
interface TopicDefinition {
  id: string;
  nome: string;
  icon: any;
  color: string;
  keywords: string[];
}

const TOPIC_DEFINITIONS: TopicDefinition[] = [
  {
    id: 'impressoras',
    nome: 'Impressoras & Impressão',
    icon: Printer,
    color: '#5A1010', // Bordô Oficial Santa Casa
    keywords: ['impressora', 'imprime', 'imprimindo', 'toner', 'papel', 'travad', 'spooler', 'zebra', 'etiqueta', 'ribbon', 'cartucho', 'scanner', 'copiador', 'folha', 'atolado']
  },
  {
    id: 'acesso_senhas',
    nome: 'Acesso, Senhas & Usuários',
    icon: Lock,
    color: '#721212', // Bordô Médio
    keywords: ['senha', 'login', 'acesso', 'usuario', 'usuário', 'bloquead', 'reset', 'permiss', 'libera', 'expirou', 'autentica', 'troca de senha', 'desbloqueio']
  },
  {
    id: 'computadores_hardware',
    nome: 'Computadores & Hardware',
    icon: Monitor,
    color: '#8a1515', // Vinho Institucional
    keywords: ['computador', 'pc', 'micro', 'cpu', 'não liga', 'nao liga', 'desliga', 'travando', 'travou', 'lento', 'lentidão', 'bipando', 'tela azul', 'monitor', 'teclado', 'mouse', 'fonte', 'format', 'hd', 'ssd', 'memória', 'nobreak']
  },
  {
    id: 'rede_internet',
    nome: 'Rede, Internet & Conectividade',
    icon: Wifi,
    color: '#9e1c1c', // Rubi Corporativo
    keywords: ['rede', 'internet', 'wifi', 'wi-fi', 'cabo', 'conexão', 'conexao', 'desconect', 'switch', 'ip', 'sem sinal', 'queda de rede', 'sem rede', 'ponto de rede']
  },
  {
    id: 'sistema_tasy',
    nome: 'Sistema Tasy & Prontuário',
    icon: Activity,
    color: '#b91c1c', // Vinho Médio
    keywords: ['tasy', 'sistema', 'prescri', 'evolu', 'atend', 'prontu', 'pep', 'relat', 'fatur', 'glosa', 'paciente', 'painel de chamada', 'recepcao', 'recepção', 'triagem', 'alta']
  },
  {
    id: 'telefonia_ramais',
    nome: 'Telefonia & Ramais',
    icon: PhoneCall,
    color: '#64748b', // Slate Corporativo
    keywords: ['ramal', 'telefone', 'aparelho', 'mudo', 'linha', 'telefonia', 'chiado', 'interfone', 'ligação']
  },
  {
    id: 'instalacao_softwares',
    nome: 'Instalações & Configurações',
    icon: Wrench,
    color: '#475569', // Slate Neutro
    keywords: ['instal', 'configur', 'atualiz', 'certificado', 'leitor', 'driver', 'antivirus', 'biometria', 'pacote office', 'excel', 'word']
  }
];

export interface RecurrentTopicItem {
  id: string;
  nome: string;
  icon: any;
  color: string;
  total: number;
  finalizadas: number;
  percentual: number;
  exemplosDanos: string[];
}

export interface EquipmentRecurrenceItem {
  key: string;
  equipamento: string;
  setor: string;
  totalOS: number;
  finalizadas: number;
  danosFrequentes: string[];
  criticidade: 'critico' | 'alto' | 'moderado' | 'normal';
}

interface GestaoOSViewProps {
  orders: OrdemServicoItem[];
  onBackToKanban: () => void;
  dateFilterLabel?: string;
  executorFilterLabel?: string | null;
}

const COLORS = {
  infra: '#5A1010', // Bordô Institucional Santa Casa
  sistema: '#8a1515', // Vinho Institucional HSC
  triagem: '#94a3b8', // Slate 400
  processo: '#721212', // Bordô Intermediário
  escalonado: '#b91c1c', // Rubi
  finalizado: '#10b981', // Verde Sucesso Padrão
};

export default function GestaoOSView({
  orders,
  onBackToKanban,
  dateFilterLabel,
  executorFilterLabel,
}: GestaoOSViewProps) {
  // Aba interna da Gestão: 'geral' (Infra vs Sistema + Setores) ou 'recorrencia' (Assuntos & Equipamentos)
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'recorrencia'>('geral');

  // Filtros da tabela de setores (Aba Geral)
  const [sectorSearch, setSectorSearch] = useState('');
  const [sectorSort, setSectorSort] = useState<'total' | 'nome'>('total');
  const [topSectorsCount, setTopSectorsCount] = useState<number>(8);

  // Filtros da aba de Recorrência (Equipamentos e Assuntos)
  const [equipSearch, setEquipSearch] = useState('');
  const [equipFilterCriticidade, setEquipFilterCriticidade] = useState<'todos' | 'reincidentes' | 'criticos'>('todos');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);

  // 1. Estatísticas Gerais e Agregação
  const stats = useMemo(() => {
    const total = orders.length;
    let infraCount = 0;
    let infraFinalizada = 0;
    let sistemaCount = 0;
    let sistemaFinalizada = 0;
    let totalFinalizadas = 0;

    // Setores map
    const sectorMap: Record<
      string,
      { nome: string; total: number; infra: number; sistema: number; finalizadas: number }
    > = {};

    // Status map
    let triagemCount = 0;
    let processoCount = 0;
    let escalonadoCount = 0;

    // ── Agrupamento de Assuntos Recorrentes por Título / Dano ──
    const topicMap: Record<
      string,
      { def: TopicDefinition; total: number; finalizadas: number; danosSet: Map<string, number> }
    > = {};

    TOPIC_DEFINITIONS.forEach(def => {
      topicMap[def.id] = {
        def,
        total: 0,
        finalizadas: 0,
        danosSet: new Map<string, number>(),
      };
    });

    let outrosTopicCount = 0;
    let outrosTopicFin = 0;
    const outrosDanosSet = new Map<string, number>();

    // ── Agrupamento de Equipamento + Setor ──
    const equipMap: Record<
      string,
      {
        equipamento: string;
        setor: string;
        total: number;
        finalizadas: number;
        danosMap: Map<string, number>;
      }
    > = {};

    orders.forEach(os => {
      const type = classifyOSType(os);
      const isFin = isOSFinalizada(os);

      if (isFin) totalFinalizadas++;

      if (type === 'Infraestrutura') {
        infraCount++;
        if (isFin) infraFinalizada++;
      } else {
        sistemaCount++;
        if (isFin) sistemaFinalizada++;
      }

      // Estágios
      const estagio = (os.ds_estagio || '').toLowerCase().trim();
      if (isFin) {
        // finalizado
      } else if (estagio === '') {
        triagemCount++;
      } else if (estagio === 'iniciada' || estagio === 'em desenvolvimento') {
        processoCount++;
      } else {
        escalonadoCount++;
      }

      // Setor
      const rawSetor = (os.ds_localizacao || 'NÃO INFORMADO').trim().toUpperCase();
      if (!sectorMap[rawSetor]) {
        sectorMap[rawSetor] = {
          nome: rawSetor,
          total: 0,
          infra: 0,
          sistema: 0,
          finalizadas: 0,
        };
      }
      sectorMap[rawSetor].total++;
      if (type === 'Infraestrutura') sectorMap[rawSetor].infra++;
      else sectorMap[rawSetor].sistema++;
      if (isFin) sectorMap[rawSetor].finalizadas++;

      // ── Processamento de Assunto Recorrente ──
      const titleText = `${os.ds_dano_breve || ''} ${os.ds_dano || ''}`.toLowerCase();
      let matchedTopicId: string | null = null;

      for (const def of TOPIC_DEFINITIONS) {
        if (def.keywords.some(kw => titleText.includes(kw))) {
          matchedTopicId = def.id;
          break;
        }
      }

      const danoLabel = (os.ds_dano_breve || os.ds_dano || 'Sem descrição').trim();

      if (matchedTopicId) {
        const item = topicMap[matchedTopicId];
        item.total++;
        if (isFin) item.finalizadas++;
        item.danosSet.set(danoLabel, (item.danosSet.get(danoLabel) || 0) + 1);
      } else {
        outrosTopicCount++;
        if (isFin) outrosTopicFin++;
        outrosDanosSet.set(danoLabel, (outrosDanosSet.get(danoLabel) || 0) + 1);
      }

      // ── Processamento de Equipamento por Setor ──
      const rawEquip = (os.ds_equipamento || 'SEM EQUIPAMENTO VINCULADO').trim().toUpperCase();
      const equipKey = `${rawEquip} | ${rawSetor}`;

      if (!equipMap[equipKey]) {
        equipMap[equipKey] = {
          equipamento: rawEquip,
          setor: rawSetor,
          total: 0,
          finalizadas: 0,
          danosMap: new Map<string, number>(),
        };
      }
      equipMap[equipKey].total++;
      if (isFin) equipMap[equipKey].finalizadas++;
      equipMap[equipKey].danosMap.set(danoLabel, (equipMap[equipKey].danosMap.get(danoLabel) || 0) + 1);
    });

    const sectorsArray = Object.values(sectorMap);
    sectorsArray.sort((a, b) => b.total - a.total);
    const topSector = sectorsArray[0] || null;

    // Formatação dos Assuntos Recorrentes
    const recurrentTopicsArray: RecurrentTopicItem[] = [];

    TOPIC_DEFINITIONS.forEach(def => {
      const item = topicMap[def.id];
      if (item.total > 0) {
        // Ordena os exemplos mais comuns
        const sortedDanos = Array.from(item.danosSet.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([d, count]) => `${d} (${count}x)`);

        recurrentTopicsArray.push({
          id: def.id,
          nome: def.nome,
          icon: def.icon,
          color: def.color,
          total: item.total,
          finalizadas: item.finalizadas,
          percentual: total > 0 ? Math.round((item.total / total) * 100) : 0,
          exemplosDanos: sortedDanos,
        });
      }
    });

    if (outrosTopicCount > 0) {
      const sortedOutros = Array.from(outrosDanosSet.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d, count]) => `${d} (${count}x)`);

      recurrentTopicsArray.push({
        id: 'outros',
        nome: 'Outros Assuntos / Não Classificados',
        icon: FileText,
        color: '#64748b',
        total: outrosTopicCount,
        finalizadas: outrosTopicFin,
        percentual: total > 0 ? Math.round((outrosTopicCount / total) * 100) : 0,
        exemplosDanos: sortedOutros,
      });
    }

    recurrentTopicsArray.sort((a, b) => b.total - a.total);
    const topTopic = recurrentTopicsArray[0] || null;

    // Formatação dos Equipamentos por Setor
    const equipmentRecurrenceArray: EquipmentRecurrenceItem[] = Object.entries(equipMap)
      .map(([key, data]) => {
        let criticidade: 'critico' | 'alto' | 'moderado' | 'normal' = 'normal';
        if (data.total >= 4) criticidade = 'critico';
        else if (data.total >= 3) criticidade = 'alto';
        else if (data.total >= 2) criticidade = 'moderado';

        const topDanos = Array.from(data.danosMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([d, c]) => `${d} (${c}x)`);

        return {
          key,
          equipamento: data.equipamento,
          setor: data.setor,
          totalOS: data.total,
          finalizadas: data.finalizadas,
          danosFrequentes: topDanos,
          criticidade,
        };
      })
      .sort((a, b) => b.totalOS - a.totalOS);

    // Contagem de reincidentes (equipamentos com >= 2 chamados)
    const reincidentesCount = equipmentRecurrenceArray.filter(
      e => e.totalOS >= 2 && e.equipamento !== 'SEM EQUIPAMENTO VINCULADO'
    ).length;

    const topEquip = equipmentRecurrenceArray.find(
      e => e.equipamento !== 'SEM EQUIPAMENTO VINCULADO'
    ) || equipmentRecurrenceArray[0] || null;

    return {
      total,
      totalFinalizadas,
      taxaResolucao: total > 0 ? Math.round((totalFinalizadas / total) * 100) : 0,
      infraCount,
      infraFinalizada,
      infraPercent: total > 0 ? Math.round((infraCount / total) * 100) : 0,
      sistemaCount,
      sistemaFinalizada,
      sistemaPercent: total > 0 ? Math.round((sistemaCount / total) * 100) : 0,
      triagemCount,
      processoCount,
      escalonadoCount,
      topSector,
      sectors: sectorsArray,
      recurrentTopics: recurrentTopicsArray,
      topTopic,
      equipmentRecurrence: equipmentRecurrenceArray,
      topEquip,
      reincidentesCount,
    };
  }, [orders]);

  // Dados para o Gráfico de Rosca (Infra vs Sistema)
  const donutData = useMemo(() => {
    return [
      { name: 'Infraestrutura', value: stats.infraCount, color: COLORS.infra },
      { name: 'Sistemas', value: stats.sistemaCount, color: COLORS.sistema },
    ].filter(d => d.value > 0);
  }, [stats]);

  // Dados para o Gráfico de Barras dos Top Setores
  const topSectorsChartData = useMemo(() => {
    return stats.sectors.slice(0, topSectorsCount).map(s => ({
      name: s.nome.length > 22 ? `${s.nome.substring(0, 20)}...` : s.nome,
      fullName: s.nome,
      Total: s.total,
      Infra: s.infra,
      Sistema: s.sistema,
    }));
  }, [stats.sectors, topSectorsCount]);

  // Dados para Gráfico de Assuntos Mais Recorrentes (Top 6)
  const recurrentTopicsChartData = useMemo(() => {
    return stats.recurrentTopics.slice(0, 7).map(t => ({
      name: t.nome.length > 18 ? `${t.nome.substring(0, 16)}...` : t.nome,
      fullName: t.nome,
      Total: t.total,
      fill: t.color,
    }));
  }, [stats.recurrentTopics]);

  // Setores filtrados pela busca da tabela
  const filteredSectors = useMemo(() => {
    let result = stats.sectors;
    if (sectorSearch.trim()) {
      const q = sectorSearch.toLowerCase();
      result = result.filter(s => s.nome.toLowerCase().includes(q));
    }
    if (sectorSort === 'nome') {
      result = [...result].sort((a, b) => a.nome.localeCompare(b.nome));
    } else {
      result = [...result].sort((a, b) => b.total - a.total);
    }
    return result;
  }, [stats.sectors, sectorSearch, sectorSort]);

  // Equipamentos filtrados pela busca e criticidade (Aba Recorrência)
  const filteredEquipments = useMemo(() => {
    let list = stats.equipmentRecurrence;

    // Filtro por criticidade
    if (equipFilterCriticidade === 'reincidentes') {
      list = list.filter(e => e.totalOS >= 2);
    } else if (equipFilterCriticidade === 'criticos') {
      list = list.filter(e => e.totalOS >= 4);
    }

    // Filtro por texto (equipamento ou setor)
    if (equipSearch.trim()) {
      const q = equipSearch.toLowerCase();
      list = list.filter(
        e => e.equipamento.toLowerCase().includes(q) || e.setor.toLowerCase().includes(q)
      );
    }

    return list;
  }, [stats.equipmentRecurrence, equipFilterCriticidade, equipSearch]);

  // Tooltip customizado para Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 border border-border shadow-xl rounded-xl p-3 text-xs backdrop-blur-md z-50">
          <p className="font-bold text-foreground mb-1.5 border-b border-border/50 pb-1">
            {payload[0]?.payload?.fullName || label || payload[0]?.name}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color || entry.fill }}
                />
                {entry.name}:
              </span>
              <span className="font-bold text-foreground">{entry.value} chamados</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-6 custom-scrollbar animate-in fade-in duration-300">
      {/* ── BARRA SUPERIOR DO PAINEL DE GESTÃO ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-card border border-border/70 rounded-2xl p-4 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToKanban}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition-all shadow-sm active:scale-95 group"
            title="Voltar ao Kanban de OS"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>Voltar ao Kanban</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Painel de Gestão & Indicadores de O.S.
              </h2>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                Tempo Real
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {executorFilterLabel ? (
                <>
                  Filtrando por executor: <strong className="text-foreground">{executorFilterLabel}</strong> ({stats.total} chamados)
                </>
              ) : (
                <>Análise de {stats.total} chamados baseada nos filtros aplicados</>
              )}
            </p>
          </div>
        </div>

        {/* Alternador de Abas Internas (Segmented Control) */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-muted/60 p-1 rounded-xl border border-border/80">
          <button
            onClick={() => setActiveSubTab('geral')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'geral'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PieChartIcon className="h-3.5 w-3.5 text-primary" />
            <span>Visão Geral & Setores</span>
          </button>

          <button
            onClick={() => setActiveSubTab('recorrencia')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
              activeSubTab === 'recorrencia'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Repeat className="h-3.5 w-3.5 text-primary" />
            <span>Reincidentes</span>
            {stats.reincidentesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-500/30">
                {stats.reincidentesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── CONTEÚDO DA ABA 1: VISÃO GERAL & SETORES ── */}
      {activeSubTab === 'geral' && (
        <>
          {/* Grid de KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Infraestrutura */}
            <div className="relative overflow-hidden bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
              <div className="absolute right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <Cpu className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Cpu className="h-4 w-4" />
                    Infraestrutura
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {stats.infraPercent}%
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tracking-tight">
                    {stats.infraCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">chamados</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Resolvidas: <strong className="text-foreground">{stats.infraFinalizada}</strong></span>
                  <span>Em Aberto: <strong className="text-primary">{stats.infraCount - stats.infraFinalizada}</strong></span>
                </div>
              </div>
            </div>

            {/* Card 2: Sistemas */}
            <div className="relative overflow-hidden bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
              <div className="absolute right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <Database className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    Sistemas
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {stats.sistemaPercent}%
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tracking-tight">
                    {stats.sistemaCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">chamados</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Resolvidas: <strong className="text-foreground">{stats.sistemaFinalizada}</strong></span>
                  <span>Em Aberto: <strong className="text-primary">{stats.sistemaCount - stats.sistemaFinalizada}</strong></span>
                </div>
              </div>
            </div>

            {/* Card 3: Top Setor */}
            <div className="relative overflow-hidden bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
              <div className="absolute right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <Building2 className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    Setor Mais Demandante
                  </span>
                  {stats.topSector && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {stats.total > 0 ? Math.round((stats.topSector.total / stats.total) * 100) : 0}%
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-lg font-black text-foreground truncate" title={stats.topSector?.nome || 'Nenhum'}>
                    {stats.topSector?.nome || 'Sem dados'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.topSector ? (
                      <>
                        <strong className="text-foreground">{stats.topSector.total}</strong> chamados registrados
                      </>
                    ) : 'Nenhum setor identificado'}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Setores Únicos: <strong className="text-foreground">{stats.sectors.length}</strong></span>
                  <span>Liderança: <strong className="text-primary">#1</strong></span>
                </div>
              </div>
            </div>

            {/* Card 4: Taxa de Resolução */}
            <div className="relative overflow-hidden bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
              <div className="absolute right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <CheckCircle2 className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Taxa de Resolução
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {stats.taxaResolucao}%
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tracking-tight">
                    {stats.totalFinalizadas}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    de {stats.total} concluídas
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Pendentes: <strong className="text-foreground">{stats.total - stats.totalFinalizadas}</strong></span>
                  <span>Eficácia: <strong className="text-emerald-600 dark:text-emerald-400">{stats.taxaResolucao >= 70 ? 'Alta' : 'Em curso'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Gráficos: Donut Infra vs Sistema + Top Setores */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Gráfico 1: Infra vs Sistema (Donut) */}
            <div className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <PieChartIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Infraestrutura vs Sistemas</h3>
                    <p className="text-[11px] text-muted-foreground">Proporção de chamados por categoria</p>
                  </div>
                </div>
              </div>

              <div className="h-64 relative flex items-center justify-center my-2">
                {stats.total === 0 ? (
                  <div className="text-center text-xs text-muted-foreground">Sem dados para o período</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={600}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {stats.total > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-foreground leading-none">{stats.total}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                      Total OS
                    </span>
                  </div>
                )}
              </div>

              {/* Legenda Informativa */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5A1010]" />
                    <span>Infraestrutura</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xl font-extrabold text-foreground">{stats.infraCount}</span>
                    <span className="text-xs font-bold text-primary">{stats.infraPercent}%</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground flex justify-between">
                    <span>{stats.infraFinalizada} resolvidos</span>
                    <span>{stats.infraCount - stats.infraFinalizada} abertos</span>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8a1515]" />
                    <span>Sistemas</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xl font-extrabold text-foreground">{stats.sistemaCount}</span>
                    <span className="text-xs font-bold text-primary">{stats.sistemaPercent}%</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground flex justify-between">
                    <span>{stats.sistemaFinalizada} resolvidos</span>
                    <span>{stats.sistemaCount - stats.sistemaFinalizada} abertos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico 2: Quantidade de OS por Setor (Top Setores) */}
            <div className="lg:col-span-7 bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-border/50 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Top Setores Demandantes</h3>
                    <p className="text-[11px] text-muted-foreground">Volume de ordens de serviço por localização</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border text-[11px] font-semibold">
                  <button
                    onClick={() => setTopSectorsCount(5)}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      topSectorsCount === 5 ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Top 5
                  </button>
                  <button
                    onClick={() => setTopSectorsCount(8)}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      topSectorsCount === 8 ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Top 8
                  </button>
                  <button
                    onClick={() => setTopSectorsCount(12)}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      topSectorsCount === 12 ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Top 12
                  </button>
                </div>
              </div>

              <div className="h-72 my-2">
                {stats.sectors.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Nenhum setor identificado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topSectorsChartData}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 10 }}
                        width={110}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="Total"
                        fill="var(--primary, #5A1010)"
                        radius={[0, 6, 6, 0]}
                        animationDuration={600}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border/50">
                <span>
                  Exibindo os <strong>{Math.min(topSectorsCount, stats.sectors.length)}</strong> setores com mais chamados
                </span>
                <span>Total de {stats.sectors.length} setores no período</span>
              </div>
            </div>
          </div>

          {/* Tabela Completa de Setores com Busca Interna */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-muted text-foreground">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Detalhamento Completo por Setor</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Lista de todos os setores e divisão entre Infra e Sistemas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar setor..."
                    value={sectorSearch}
                    onChange={e => setSectorSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                <button
                  onClick={() => setSectorSort(prev => (prev === 'total' ? 'nome' : 'total'))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-all shrink-0"
                  title="Alternar ordenação"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{sectorSort === 'total' ? 'Por Volume' : 'Por Nome'}</span>
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto max-h-80 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Setor / Localização</th>
                    <th className="py-2.5 px-3 text-center">Infraestrutura</th>
                    <th className="py-2.5 px-3 text-center">Sistemas</th>
                    <th className="py-2.5 px-3 text-center">Finalizadas</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">% Participação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredSectors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                        Nenhum setor encontrado para a busca "{sectorSearch}".
                      </td>
                    </tr>
                  ) : (
                    filteredSectors.map((s, idx) => {
                      const partPercent = stats.total > 0 ? Math.round((s.total / stats.total) * 100) : 0;
                      return (
                        <tr
                          key={s.nome}
                          className="hover:bg-muted/40 transition-colors group"
                        >
                          <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground w-5 text-right">
                              #{idx + 1}
                            </span>
                            <span className="truncate max-w-xs sm:max-w-md" title={s.nome}>
                              {s.nome}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-[11px]">
                              {s.infra}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold text-[11px]">
                              {s.sistema}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-muted-foreground font-medium">
                            {s.finalizadas} / {s.total}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-foreground">
                            {s.total}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-muted-foreground text-[11px]">
                                {partPercent}%
                              </span>
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(5, partPercent))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── CONTEÚDO DA ABA 2: ASSUNTOS & EQUIPAMENTOS RECORRENTES ── */}
      {activeSubTab === 'recorrencia' && (
        <>
          {/* Cards de Destaque de Recorrência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Assunto Mais Recorrente */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
              <div className="absolute right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <Repeat className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Repeat className="h-4 w-4" />
                    Problema Mais Frequente
                  </span>
                  {stats.topTopic && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {stats.topTopic.percentual}% das OS
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-base font-black text-foreground truncate" title={stats.topTopic?.nome || 'Nenhum'}>
                    {stats.topTopic?.nome || 'Sem dados'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.topTopic ? (
                      <>
                        <strong className="text-foreground">{stats.topTopic.total}</strong> ocorrências registradas
                      </>
                    ) : 'Nenhum chamado categorizado'}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground flex justify-between">
                  <span>Resolvidas: <strong className="text-foreground">{stats.topTopic?.finalizadas || 0}</strong></span>
                  <span>Impacto: <strong className="text-primary">Líder #1</strong></span>
                </div>
              </div>
            </div>

            {/* KPI 2: Equipamento Mais Crítico */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
              <div className="absolute right-2 -bottom-2 text-rose-500/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <AlertOctagon className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertOctagon className="h-4 w-4" />
                    Equipamento Mais Crítico
                  </span>
                  {stats.topEquip && stats.topEquip.totalOS >= 2 && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      🚨 Reincidente
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-base font-black text-foreground truncate" title={stats.topEquip?.equipamento || 'Sem dados'}>
                    {stats.topEquip?.equipamento || 'Nenhum'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate" title={`Setor: ${stats.topEquip?.setor || ''}`}>
                    Setor: <strong className="text-foreground">{stats.topEquip?.setor || 'Não informado'}</strong>
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground flex justify-between">
                  <span>Falhas no período: <strong className="text-rose-600 dark:text-rose-400">{stats.topEquip?.totalOS || 0} chamados</strong></span>
                </div>
              </div>
            </div>

            {/* KPI 3: Equipamentos Reincidentes */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
              <div className="absolute right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <Flame className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Flame className="h-4 w-4" />
                    Equipamentos Reincidentes
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    &ge; 2 chamados
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tracking-tight">
                    {stats.reincidentesCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">máquinas/aparelhos</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground flex justify-between">
                  <span>Atenção Preventiva: <strong className="text-primary">{stats.reincidentesCount > 0 ? 'Requer revisão' : 'Zero reincidência'}</strong></span>
                </div>
              </div>
            </div>

            {/* KPI 4: Variedade de Problemas */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
              <div className="absolute right-2 -bottom-2 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                <Layers className="w-20 h-20" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4" />
                    Categorias Mapeadas
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">
                    {stats.recurrentTopics.length} temas
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tracking-tight">
                    {stats.recurrentTopics.length}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">tipos de demandas</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground flex justify-between">
                  <span>Cobertura analítica: <strong className="text-foreground">100% dos chamados</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico de Barras: Assuntos Mais Recorrentes (pelo Dano) */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-border/50 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Ranking de Assuntos Mais Recorrentes</h3>
                  <p className="text-[11px] text-muted-foreground">Classificação por tema identificado no título e descrição do dano</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                Total de {stats.total} chamados analisados
              </span>
            </div>

            <div className="h-64 my-3">
              {stats.recurrentTopics.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sem chamados para categorização no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={recurrentTopicsChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={140}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="Total"
                      fill="var(--primary, #5A1010)"
                      radius={[0, 6, 6, 0]}
                      animationDuration={600}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Cards Analíticos de cada Assunto Recorrente */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-border/50">
              {stats.recurrentTopics.map(topic => {
                const IconComponent = topic.icon;
                return (
                  <div
                    key={topic.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <h4 className="text-xs font-bold text-foreground truncate" title={topic.nome}>
                            {topic.nome}
                          </h4>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {topic.percentual}%
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-black text-foreground">{topic.total}</span>
                        <span className="text-xs text-muted-foreground">chamados ({topic.finalizadas} resolvidos)</span>
                      </div>

                      {topic.exemplosDanos.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Principais Sintomas:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {topic.exemplosDanos.map((ex, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-foreground/80 truncate max-w-full"
                                title={ex}
                              >
                                {ex}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PAINEL DE EQUIPAMENTOS REINCIDENTES POR SETOR ── */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Laptop className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Recorrência por Equipamento & Setor</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Identifique máquinas e impressoras que apresentam defeitos repetitivos em cada setor
                  </p>
                </div>
              </div>

              {/* Filtros da Tabela de Equipamentos */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Filtro por Criticidade */}
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border text-[11px] font-semibold">
                  <button
                    onClick={() => setEquipFilterCriticidade('todos')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      equipFilterCriticidade === 'todos' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setEquipFilterCriticidade('reincidentes')}
                    className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                      equipFilterCriticidade === 'reincidentes' ? 'bg-card text-foreground shadow-xs font-bold text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Equipamentos com 2 ou mais chamados"
                  >
                    <span>Reincidentes (&ge;2)</span>
                  </button>
                  <button
                    onClick={() => setEquipFilterCriticidade('criticos')}
                    className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                      equipFilterCriticidade === 'criticos' ? 'bg-card text-foreground shadow-xs font-bold text-rose-600 dark:text-rose-400' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Equipamentos com 4 ou mais chamados"
                  >
                    <span>Críticos (&ge;4)</span>
                  </button>
                </div>

                {/* Campo de Busca por Equipamento ou Setor */}
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar equipamento ou setor..."
                    value={equipSearch}
                    onChange={e => setEquipSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Tabela de Equipamentos Reincidentes */}
            <div className="mt-3 overflow-x-auto max-h-96 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Equipamento</th>
                    <th className="py-2.5 px-3">Setor / Localização</th>
                    <th className="py-2.5 px-3 text-center">Nível de Criticidade</th>
                    <th className="py-2.5 px-3">Problemas Recorrentes no Equipamento</th>
                    <th className="py-2.5 px-3 text-center">Resolvidas</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Total de O.S.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredEquipments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum equipamento reincidente encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredEquipments.map((eq, idx) => {
                      return (
                        <tr
                          key={eq.key}
                          className="hover:bg-muted/40 transition-colors group"
                        >
                          {/* Nome do Equipamento */}
                          <td className="py-3 px-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-4">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-foreground block truncate max-w-xs" title={eq.equipamento}>
                                  {eq.equipamento}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Setor */}
                          <td className="py-3 px-3 text-muted-foreground font-medium">
                            <div className="flex items-center gap-1.5 truncate max-w-xs" title={eq.setor}>
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                              <span className="truncate">{eq.setor}</span>
                            </div>
                          </td>

                          {/* Criticidade */}
                          <td className="py-3 px-3 text-center">
                            {eq.criticidade === 'critico' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                <AlertOctagon className="h-3 w-3" />
                                Crítico (&ge;4 OS)
                              </span>
                            ) : eq.criticidade === 'alto' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                <Flame className="h-3 w-3" />
                                Alto (3 OS)
                              </span>
                            ) : eq.criticidade === 'moderado' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                <Repeat className="h-3 w-3" />
                                Reincidente (2 OS)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                Pontual (1 OS)
                              </span>
                            )}
                          </td>

                          {/* Danos Frequentes */}
                          <td className="py-3 px-3 text-xs">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {eq.danosFrequentes.length > 0 ? (
                                eq.danosFrequentes.map((d, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-foreground/80 truncate max-w-full"
                                    title={d}
                                  >
                                    {d}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sem histórico detalhado</span>
                              )}
                            </div>
                          </td>

                          {/* Finalizadas */}
                          <td className="py-3 px-3 text-center text-muted-foreground font-semibold">
                            <span className={eq.finalizadas === eq.totalOS ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                              {eq.finalizadas} / {eq.totalOS}
                            </span>
                          </td>

                          {/* Total de OS */}
                          <td className="py-3 px-3 text-right">
                            <span className="text-sm font-black text-foreground">
                              {eq.totalOS}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-muted-foreground gap-2">
              <span>
                Exibindo <strong>{filteredEquipments.length}</strong> equipamentos listados com os filtros atuais.
              </span>
              <span>
                💡 <em>Dica: Equipamentos com mais de 2 chamados frequentes exigem manutenção preventiva ou substituição de peças.</em>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
