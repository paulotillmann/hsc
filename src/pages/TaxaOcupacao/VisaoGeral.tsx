import React, { useEffect, useState, useMemo } from 'react';
import { BedDouble, Loader2, Calendar as CalendarIcon, Clock, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface OcupacaoDia {
  id: string;
  data: string;
  horario_envio: string;
  total_leitos: number;
  total_leitos_sus: number;
  taxa_setores: {
    nome_setor: string;
    leitos_tipo: string | null;
    calcular_taxa: string | null;
  };
  taxa_ocupacao_dia_setor_leito: {
    qtd_leitos_dia: number;
    qtd_leitos_sus: number;
    padrao: boolean;
  }[];
}

const COLOR_OCUPADOS = '#4A1513';
const COLOR_LIVRES = '#D1A7A5';

export default function VisaoGeral() {
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState<string>('');
  const [horarioFiltro, setHorarioFiltro] = useState<string>('10:00');
  const [visaoFiltro, setVisaoFiltro] = useState<string>('Ambos'); // 'Ambos' | 'Geral' | 'SUS'
  const [lancamentos, setLancamentos] = useState<OcupacaoDia[]>([]);
  const [dadosNaoEncontrados, setDadosNaoEncontrados] = useState(false);

  // No primeiro load, busca a data/hora mais recente para iniciar os filtros
  useEffect(() => {
    async function initializeFilters() {
      try {
        setLoading(true);
        const { data: latestRecords, error: errLatest } = await supabase
          .from('taxa_ocupacao_dia')
          .select('data, horario_envio')
          .order('data', { ascending: false })
          .order('horario_envio', { ascending: false })
          .limit(1);

        if (errLatest) throw errLatest;
        
        if (latestRecords && latestRecords.length > 0) {
          setDataFiltro(latestRecords[0].data);
          setHorarioFiltro(latestRecords[0].horario_envio);
        } else {
          // Fallback para data atual se estiver vazio
          setDataFiltro(new Date().toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error('Erro ao buscar filtros iniciais:', error);
      } finally {
        setLoading(false);
      }
    }
    initializeFilters();
  }, []);

  // Busca os dados baseados nos filtros
  useEffect(() => {
    if (!dataFiltro || !horarioFiltro) return;

    async function fetchFilteredData() {
      try {
        setLoading(true);
        const { data: records, error: errRecords } = await supabase
          .from('taxa_ocupacao_dia')
          .select(`
            id,
            data,
            horario_envio,
            total_leitos,
            total_leitos_sus,
            taxa_setores ( nome_setor, leitos_tipo, calcular_taxa ),
            taxa_ocupacao_dia_setor_leito (
              qtd_leitos_dia,
              qtd_leitos_sus,
              padrao
            )
          `)
          .eq('data', dataFiltro)
          .eq('horario_envio', horarioFiltro);

        if (errRecords) throw errRecords;
        
        setLancamentos((records as unknown as OcupacaoDia[]) || []);
        setDadosNaoEncontrados(!records || records.length === 0);
      } catch (error) {
        console.error('Erro ao buscar dados da visão geral:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchFilteredData();
  }, [dataFiltro, horarioFiltro]);

  const { statsGeral, statsSUS } = useMemo(() => {
    // Totais
    let leitosGeral = 0;
    let ocupadosGeral = 0;
    
    let leitosSUS = 0;
    let ocupadosSUS = 0;

    lancamentos.forEach(record => {
      const detalhes = record.taxa_ocupacao_dia_setor_leito || [];
      const totalOcupadosNaoSus = detalhes
        .filter(d => d.padrao !== false)
        .reduce((acc, curr) => acc + Number(curr.qtd_leitos_dia || 0), 0);
      const totalOcupadosSus = detalhes
        .filter(d => d.padrao !== false)
        .reduce((acc, curr) => acc + Number(curr.qtd_leitos_sus || 0), 0);
      const totalOcupados = totalOcupadosNaoSus + totalOcupadosSus;

      const isSUS = record.taxa_setores?.leitos_tipo === 'SUS';
      const baseLeitosExibicao = isSUS ? Number(record.total_leitos_sus || 0) : Number(record.total_leitos || 0);

      // Regra Filtro Geral
      const isFiltroGeral = 
        (record.taxa_setores?.leitos_tipo === 'SUS' && record.taxa_setores?.calcular_taxa === 'Ambos') ||
        (record.taxa_setores?.leitos_tipo === 'Particular ou convênio' && record.taxa_setores?.calcular_taxa === 'Geral') ||
        (record.taxa_setores?.leitos_tipo === 'Ambos' && record.taxa_setores?.calcular_taxa === 'Geral');

      if (isFiltroGeral) {
        leitosGeral += baseLeitosExibicao;
        ocupadosGeral += totalOcupados;
      }

      // Regra Filtro SUS
      if (isSUS) {
        leitosSUS += baseLeitosExibicao;
        ocupadosSUS += totalOcupados;
      }
    });

    const livresGeral = Math.max(0, leitosGeral - ocupadosGeral);
    const livresSUS = Math.max(0, leitosSUS - ocupadosSUS);

    return {
      statsGeral: { total: leitosGeral, ocupados: ocupadosGeral, livres: livresGeral },
      statsSUS: { total: leitosSUS, ocupados: ocupadosSUS, livres: livresSUS }
    };
  }, [lancamentos]);

  const percentGeral = statsGeral.total > 0 ? Math.round((statsGeral.ocupados / statsGeral.total) * 100) : 0;
  const percentSUS = statsSUS.total > 0 ? Math.round((statsSUS.ocupados / statsSUS.total) * 100) : 0;

  const dataChartGeral = [
    { name: 'Ocupados', value: statsGeral.ocupados, color: COLOR_OCUPADOS },
    { name: 'Livres', value: statsGeral.livres, color: COLOR_LIVRES },
  ];

  const dataChartSUS = [
    { name: 'Ocupados', value: statsSUS.ocupados, color: COLOR_OCUPADOS },
    { name: 'Livres', value: statsSUS.livres, color: COLOR_LIVRES },
  ];

  if (loading && !dataFiltro) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 w-full animate-in fade-in zoom-in duration-500">
      {/* Header com Filtros */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BedDouble className="h-6 w-6 text-primary" />
            Visão Geral: Taxa de Ocupação
          </h1>
          <p className="text-muted-foreground mt-1">
            Indicadores consolidados de ocupação por data e horário.
          </p>
        </div>
        
        {/* Painel de Filtros */}
        <div className="bg-card shadow-sm border border-border rounded-xl px-4 py-2 flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <input 
              type="date" 
              className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer w-full"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
            />
          </div>
          <div className="hidden sm:block w-px h-6 bg-border"></div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <select 
              className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer w-full"
              value={horarioFiltro}
              onChange={(e) => setHorarioFiltro(e.target.value)}
            >
              <option value="10:00" className="bg-background text-foreground">10:00</option>
              <option value="20:00" className="bg-background text-foreground">20:00</option>
            </select>
          </div>
          <div className="hidden sm:block w-px h-6 bg-border"></div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer w-full"
              value={visaoFiltro}
              onChange={(e) => setVisaoFiltro(e.target.value)}
            >
              <option value="Ambos" className="bg-background text-foreground">Geral e SUS</option>
              <option value="Geral" className="bg-background text-foreground">Apenas Geral</option>
              <option value="SUS" className="bg-background text-foreground">Apenas SUS</option>
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex flex-1 items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : dadosNaoEncontrados ? (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed rounded-lg p-12">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Nenhum dado encontrado</h2>
            <p className="text-muted-foreground max-w-sm">
              Não existem registros de ocupação para o dia e horário selecionados.
            </p>
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${visaoFiltro === 'Ambos' ? 'md:grid-cols-2 max-w-5xl' : 'max-w-xl'} gap-8 lg:gap-12 mt-4 mx-auto w-full`}>
          
          {/* Card GERAL */}
          {visaoFiltro !== 'SUS' && (
            <div className="bg-card rounded-2xl shadow-sm border p-6 flex flex-col items-center">
              <h2 className="text-lg font-bold text-foreground mb-6 uppercase tracking-wider text-center">Taxa de Ocupação Geral</h2>
              
              <div className="relative w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataChartGeral}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={110}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={20}
                      paddingAngle={5}
                    >
                      {dataChartGeral.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>

                  </PieChart>
                </ResponsiveContainer>
                {/* Texto Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-5xl font-extrabold text-foreground leading-none">{statsGeral.total}</span>
                  <span className="text-sm font-medium text-muted-foreground mt-2">leitos</span>
                </div>
              </div>

              <div className="mt-8 flex justify-center items-center gap-6 text-[15px] font-medium w-full">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_OCUPADOS }}></div>
                  <span className="text-foreground">Ocupados ({statsGeral.ocupados})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_LIVRES }}></div>
                  <span className="text-foreground">Livres ({statsGeral.livres})</span>
                </div>
              </div>
            </div>
          )}

          {/* Card SUS */}
          {visaoFiltro !== 'Geral' && (
            <div className="bg-card rounded-2xl shadow-sm border p-6 flex flex-col items-center">
              <h2 className="text-lg font-bold text-foreground mb-6 uppercase tracking-wider text-center">Taxa de Ocupação SUS</h2>
              
              <div className="relative w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataChartSUS}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={110}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={20}
                      paddingAngle={5}
                    >
                      {dataChartSUS.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>

                  </PieChart>
                </ResponsiveContainer>
                {/* Texto Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-5xl font-extrabold text-foreground leading-none">{statsSUS.total}</span>
                  <span className="text-sm font-medium text-muted-foreground mt-2">leitos</span>
                </div>
              </div>

              <div className="mt-8 flex justify-center items-center gap-6 text-[15px] font-medium w-full">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_OCUPADOS }}></div>
                  <span className="text-foreground">Ocupados ({statsSUS.ocupados})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_LIVRES }}></div>
                  <span className="text-foreground">Livres ({statsSUS.livres})</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

