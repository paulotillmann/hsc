import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Clock,
  UserCheck,
  ShieldAlert,
  FileText,
  RefreshCw,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  CheckCircle
} from 'lucide-react';

import Quedas from './indicadores/Quedas';
import Reinternacoes from './indicadores/Reinternacoes';
import Mortalidade from './indicadores/Mortalidade';
import EsperaEntradaInicio from './indicadores/EsperaEntradaInicio';
import EsperaEntradaTriagem from './indicadores/EsperaEntradaTriagem';
import EsperaFimTriagemConsulta from './indicadores/EsperaFimTriagemConsulta';
import MediaInternacao from './indicadores/MediaInternacao';
import MediaPermanencia from './indicadores/MediaPermanencia';

interface IndicadorMenu {
  id: string;
  name: string;
  shortName: string;
  path: string;
  icon: any;
  meta: string;
  descricao: string;
}

const MENU_INDICADORES: IndicadorMenu[] = [
  {
    id: 'queda',
    name: 'Incidência de Quedas com Dano',
    shortName: 'Quedas com Dano',
    path: 'queda',
    icon: ShieldAlert,
    meta: '< 2 por 1000 pac-dia',
    descricao: 'Monitoramento do número total de quedas registradas com dano no hospital.'
  },
  {
    id: 'reinternacao',
    name: 'Reinternação em 30 dias',
    shortName: 'Reinternações',
    path: 'reinternacao',
    icon: RefreshCw,
    meta: '<= 20%',
    descricao: 'Percentual de pacientes que reinternam no período de até 30 dias após a alta anterior.'
  },
  {
    id: 'taxa_mortalidade',
    name: 'Taxa de Mortalidade Institucional',
    shortName: 'Taxa Mortalidade',
    path: 'taxa-mortalidade',
    icon: Activity,
    meta: '< 3.0%',
    descricao: 'Percentual de óbitos ocorridos em relação ao total de saídas da internação.'

  },
  {
    id: 'espera_entrada_inicio',
    name: 'Espera (Entrada - Início Consulta)',
    shortName: 'Espera Entrada/Consulta',
    path: 'tempo-espera-entrada-consulta',
    icon: Clock,
    meta: '< 45 min',
    descricao: 'Média de tempo decorrido da entrada na recepção até o início da consulta médica.'
  },
  {
    id: 'entrada_triagem',
    name: 'Espera (Entrada - Início Triagem)',
    shortName: 'Espera Entrada/Triagem',
    path: 'tempo-espera-entrada-triagem',
    icon: UserCheck,
    meta: '< 15 min',
    descricao: 'Média de tempo decorrido da entrada na recepção até o acolhimento para triagem.'
  },
  {
    id: 'fimTriagem_consulta',
    name: 'Espera (Fim Triagem - Início Consulta)',
    shortName: 'Espera Triagem/Consulta',
    path: 'tempo-espera-triagem-consulta',
    icon: FileText,
    meta: '< 30 min',
    descricao: 'Média de tempo decorrido da conclusão da triagem até o início da consulta.'
  },
  {
    id: 'media_interncacao',
    name: 'Tempo Médio de Internação',
    shortName: 'Permanência Geral',
    path: 'tempo-medio-internacao',
    icon: Calendar,
    meta: '< 5.5 dias',
    descricao: 'Média de permanência de pacientes em leitos de internação geral e crítica.'
  },
  {
    id: 'media_permanencia',
    name: 'Tempo de Permanência na Emergência',
    shortName: 'Permanência Emergência',
    path: 'tempo-medio-permanencia-emergencia',
    icon: Clock,
    meta: '< 4.0 horas',
    descricao: 'Tempo médio de pacientes em observação na emergência/pronto atendimento.'
  }
];

export interface KpiData {
  taxaMedia: string | number;
  labelTaxa: string;
  totalValue: string | number;
  totalLabel: string;
  meta: string;
  metaDesc: string;
  usingMock: boolean;
  tendencia: 'alta' | 'baixa';
  loading: boolean;
}

export default function Qualidade() {
  const navigate = useNavigate();
  const location = useLocation();

  // Inicializa filtros de datas (Período do mês atual)
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState<string>(firstDayOfMonth);
  const [dataFim, setDataFim] = useState<string>(today);
  const [kpiInfo, setKpiInfo] = useState<KpiData | null>(null);

  // Determinar qual indicador está ativo com base no path atual
  const activePath = location.pathname.split('/').pop() || 'queda';
  const indicadorAtivo = MENU_INDICADORES.find(i => i.path === activePath) || MENU_INDICADORES[0];

  return (
    <div className="w-full space-y-6">

      {/* Cabeçalho Unificado */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-card border border-border/50 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-primary/10 text-primary rounded-xl">
              <Activity className="h-6 w-6 text-primary" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestão da Qualidade</h1>
          </div>
          <p className="text-muted-foreground text-xs mt-1.5 max-w-2xl leading-normal">
            Painel integrado de monitoramento de performance e segurança do paciente.
            Utilize os filtros abaixo para parametrizar e analisar os dados.
          </p>
        </div>

        {/* Filtros de Data e Indicadores Globais */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-muted/20 border p-3 rounded-xl">
          <div className="flex flex-col gap-1 w-full sm:w-64">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Indicador Hospitalar</label>
            <select
              value={indicadorAtivo.path}
              onChange={(e) => {
                setKpiInfo(null);
                navigate(`/qualidade/${e.target.value}`);
              }}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer h-8 w-full font-medium"
            >
              {MENU_INDICADORES.map((ind) => (
                <option key={ind.id} value={ind.path}>
                  {ind.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer h-8"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer h-8"
            />
          </div>
        </div>
      </div>

      {/* Aviso de Modo Demonstrativo / Falha de Integração */}
      {kpiInfo?.usingMock && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl p-4 flex gap-3 items-center animate-in slide-in-from-top-4 duration-300">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-xs font-semibold">Sem comunicação em tempo real com as bases do Tasy / Hospital.</p>
            <p className="text-[11px] opacity-90 mt-0.5">Não foi possível estabelecer conexão imediata com o servidor de dados. O painel está exibindo dados simulados (demonstrativos).</p>
          </div>
        </div>
      )}

      {/* Caixa Informativa do Indicador Atual */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 items-start animate-in fade-in duration-300">
        <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-sm text-primary">{indicadorAtivo.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-normal">{indicadorAtivo.descricao}</p>
        </div>
      </div>

      {/* Layout Split Screen: KPIs na lateral esquerda e Conteúdo do indicador na direita */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* Coluna de KPIs (Esquerda) */}
        <div id="kpis-card-container" className="lg:col-span-1 flex flex-col gap-4">
          {kpiInfo && !kpiInfo.loading ? (
            <>
              {/* Card 1: KPI Principal */}
              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col justify-between h-[150px] relative overflow-hidden">
                <div className="z-10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{kpiInfo.labelTaxa}</span>
                  <h2 className="text-3xl font-extrabold mt-2 tracking-tight text-foreground">
                    {kpiInfo.taxaMedia}
                  </h2>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-3 z-10 text-xs gap-2">
                  <div className="text-left flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-tight">{kpiInfo.totalLabel}</p>
                    <p className="font-bold text-foreground mt-0.5">{kpiInfo.totalValue}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${kpiInfo.tendencia === 'baixa'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                    {kpiInfo.tendencia === 'baixa' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {kpiInfo.tendencia === 'baixa' ? 'Sob Controle' : 'Alerta'}
                  </span>
                </div>
                {indicadorAtivo.icon && (
                  <div className="absolute -right-4 -top-4 text-muted-foreground/5 pointer-events-none transform rotate-12">
                    {React.createElement(indicadorAtivo.icon, { size: 100 })}
                  </div>
                )}
              </div>

              {/* Card 2: Meta */}
              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col justify-between h-[150px]">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Meta Institucional</span>
                  <h3 className="text-sm font-bold mt-2 text-foreground">
                    {kpiInfo.meta}
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal mt-2">
                  {kpiInfo.metaDesc}
                </p>
              </div>

              {/* Card 3: Status de Integração */}
              {kpiInfo.usingMock ? (
                <div className="bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl p-5 flex flex-col justify-between h-[150px]">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertCircle className="h-4 w-4" />
                    <span>Modo Demonstrativo</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal mt-2">
                    Exibindo dados simulados e estimativas de performance.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl p-5 flex flex-col justify-between h-[150px]">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle className="h-4 w-4" />
                    <span>Dados Integrados</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal mt-2">
                    Painel integrado em tempo real com as bases de dados do hospital.
                  </p>
                </div>
              )}
            </>
          ) : (
            // Skeletons de Loading
            <>
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm h-[150px] animate-pulse flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                    <div className="h-8 bg-muted rounded w-2/3"></div>
                  </div>
                  <div className="h-4 bg-muted rounded w-full border-t border-border/40 pt-3"></div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Painel do Indicador Ativo (Direita) */}
        <div className="lg:col-span-3 bg-card border border-border/50 p-6 rounded-2xl shadow-sm min-h-[500px]">
          <Routes>
            <Route path="queda" element={<Quedas dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="reinternacao" element={<Reinternacoes dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="taxa-mortalidade" element={<Mortalidade dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="tempo-espera-entrada-consulta" element={<EsperaEntradaInicio dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="tempo-espera-entrada-triagem" element={<EsperaEntradaTriagem dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="tempo-espera-triagem-consulta" element={<EsperaFimTriagemConsulta dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="tempo-medio-internacao" element={<MediaInternacao dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />
            <Route path="tempo-medio-permanencia-emergencia" element={<MediaPermanencia dataInicio={dataInicio} dataFim={dataFim} onKpiChange={setKpiInfo} />} />

            {/* Redirecionamento default para Quedas */}
            <Route path="*" element={<Navigate to="queda" replace />} />
          </Routes>
        </div>

      </div>

    </div>
  );
}
