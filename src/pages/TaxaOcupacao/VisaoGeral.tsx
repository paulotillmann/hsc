// Atualizado: Trigger HMR
import React, { useEffect, useState, useMemo } from 'react';
import { BedDouble, Loader2, Calendar as CalendarIcon, Clock, Filter, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import ConfigRelatorioModal from './ConfigRelatorioModal';

interface OcupacaoDia {
  id: string;
  data: string;
  horario_envio: string;
  created_at: string;
  setor_id: string;
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
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState<string>('');
  const [horarioFiltro, setHorarioFiltro] = useState<string>('10:00');
  const [visaoFiltro, setVisaoFiltro] = useState<string>('Hospital Geral'); // 'Hospital Geral' | 'SUS'
  const [lancamentos, setLancamentos] = useState<OcupacaoDia[]>([]);
  const [dadosNaoEncontrados, setDadosNaoEncontrados] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

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
            created_at,
            setor_id,
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

  const panelRecords = useMemo(() => {
    let filtered = lancamentos;

    if (visaoFiltro === 'SUS') {
      filtered = filtered.filter(l => l.taxa_setores?.leitos_tipo === 'SUS');
    }

    return filtered;
  }, [lancamentos, visaoFiltro]);


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

        <div className="flex items-center gap-3">
          {/* Botão Config - Apenas Admin */}
          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2.5 bg-card border rounded-xl hover:bg-muted/50 transition-colors shadow-sm"
              title="Configurar envio automático de relatório"
            >
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </button>
          )}

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
                <option value="Hospital Geral" className="bg-background text-foreground">Hospital Geral</option>
                <option value="SUS" className="bg-background text-foreground">SUS</option>
              </select>
            </div>
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4 w-full items-start">

          <div className="xl:col-span-4 w-full flex flex-col gap-6">
            {/* Card GERAL (Exibido apenas em Hospital Geral) */}
            {visaoFiltro === 'Hospital Geral' && (
              <div className="bg-card rounded-2xl shadow-sm border p-4 flex flex-col items-center">
                <h2 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wider text-center">Taxa de Ocupação Geral</h2>

                <div className="relative w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataChartGeral}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
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
                    <span className="text-4xl font-extrabold text-foreground leading-none">{statsGeral.total}</span>
                    <span className="text-sm font-medium text-muted-foreground mt-1">leitos</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-center items-center gap-6 text-[15px] font-medium w-full">
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
            {(visaoFiltro === 'SUS' || visaoFiltro === 'Hospital Geral') && (
              <div className="bg-card rounded-2xl shadow-sm border p-4 flex flex-col items-center">
                <h2 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wider text-center">Taxa de Ocupação SUS</h2>

                <div className="relative w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataChartSUS}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
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
                    <span className="text-4xl font-extrabold text-foreground leading-none">{statsSUS.total}</span>
                    <span className="text-sm font-medium text-muted-foreground mt-1">leitos</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-center items-center gap-6 text-[15px] font-medium w-full">
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

          {/* Table Grid */}
          <div className="xl:col-span-8 bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden w-full">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Lançamentos de Taxas do dia</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <CalendarIcon className="h-4 w-4" />
                  {new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-BR')}
                  <span className="mx-1">•</span>
                  <Clock className="h-4 w-4" />
                  {horarioFiltro}
                </p>
              </div>
            </div>

            <div className="p-0 overflow-auto bg-muted/5">
              {panelRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 p-6 text-center">
                  <p>Nenhum setor encontrado para este horário.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Setor</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Leitos</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Ocupados</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Ocup.<br />Não SUS</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Ocup.<br />SUS</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Isolados</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Livres</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Disp.</th>
                        <th className="px-2 py-2 font-semibold text-center w-[80px] leading-tight">Taxa<br />Ocup.</th>
                        <th className="px-2 py-2 font-semibold text-center">Atual.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {panelRecords.map((record, index) => {
                        const detalhes = record.taxa_ocupacao_dia_setor_leito || [];
                        const totalOcupadosNaoSus = detalhes
                          .filter(d => d.padrao !== false)
                          .reduce((acc, curr) => acc + Number(curr.qtd_leitos_dia || 0), 0);
                        const totalOcupadosSus = detalhes
                          .filter(d => d.padrao !== false)
                          .reduce((acc, curr) => acc + Number(curr.qtd_leitos_sus || 0), 0);
                        const totalOcupados = totalOcupadosNaoSus + totalOcupadosSus;

                        const isolados = detalhes
                          .filter(d => d.padrao === false)
                          .reduce((acc, curr) => acc + Number(curr.qtd_leitos_dia || 0) + Number(curr.qtd_leitos_sus || 0), 0);

                        const isSUS = record.taxa_setores?.leitos_tipo === 'SUS';
                        const baseLeitosExibicao = isSUS ? Number(record.total_leitos_sus || 0) : Number(record.total_leitos || 0);

                        const leitosLivres = Math.max(0, baseLeitosExibicao - totalOcupados);
                        const leitosDisponiveis = leitosLivres;
                        const taxaOcupacao = baseLeitosExibicao > 0 ? Math.min(100, (totalOcupados / baseLeitosExibicao) * 100) : 0;

                        const dataAtual = new Date(record.created_at);
                        const atualTime = `${String(dataAtual.getHours()).padStart(2, '0')}:${String(dataAtual.getMinutes()).padStart(2, '0')}`;

                        return (
                          <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-2 py-2 font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={record.taxa_setores?.nome_setor}>
                              <div className="flex flex-col">
                                <span className="truncate">{record.taxa_setores?.nome_setor}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center font-medium">{baseLeitosExibicao}</td>
                            <td className="px-2 py-2 text-center font-medium">{totalOcupados}</td>
                            <td className="px-2 py-2 text-center">{totalOcupadosNaoSus}</td>
                            <td className="px-2 py-2 text-center">{totalOcupadosSus}</td>
                            <td className="px-2 py-2 text-center text-yellow-600 dark:text-yellow-500 font-medium">{isolados}</td>
                            <td className="px-2 py-2 text-center">{leitosLivres}</td>
                            <td className="px-2 py-2 text-center">{leitosDisponiveis}</td>
                            <td className="px-2 py-2 text-center">
                              <div className="relative w-full h-6 bg-muted/40 rounded overflow-hidden flex items-center justify-center border border-border/50">
                                <div
                                  className="absolute left-0 top-0 h-full bg-[#8c1c13] transition-all duration-500"
                                  style={{ width: `${taxaOcupacao}%` }}
                                />
                                <span className={`relative z-10 text-xs font-bold ${taxaOcupacao > 50 ? 'text-white' : 'text-foreground'}`}>
                                  {taxaOcupacao.toFixed(1).replace('.0', '')}%
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center text-xs text-muted-foreground">{atualTime}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração */}
      <ConfigRelatorioModal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
}
