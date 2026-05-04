import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Loader2, Calendar as CalendarIcon, Clock, AlertCircle, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BubbleSyncModal } from '../../components/BubbleSyncModal';

interface OcupacaoDia {
  id: string;
  data: string;
  horario_envio: string;
  total_leitos: number;
  total_leitos_sus: number;
  setor_id: string;
  created_at: string;
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

const formatToLocalISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const LancamentoTaxas: React.FC = () => {
  const navigate = useNavigate();
  const [lancamentos, setLancamentos] = useState<OcupacaoDia[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(() => formatToLocalISO(new Date()));
  const [selectedTime, setSelectedTime] = useState<'10:00' | '20:00' | null>(() => {
    const hour = new Date().getHours();
    if (hour >= 20) return '20:00';
    if (hour >= 10) return '10:00';
    return null;
  });

  const [filterCategoria, setFilterCategoria] = useState<string>('Geral');
  const [isBubbleModalOpen, setIsBubbleModalOpen] = useState(false);

  const getMonthBoundaries = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
  };

  useEffect(() => {
    fetchLancamentos(currentDate);
  }, [currentDate]);

  const fetchLancamentos = async (date: Date) => {
    try {
      setLoading(true);
      const { start, end } = getMonthBoundaries(date);
      const startStr = formatToLocalISO(start);
      const endStr = formatToLocalISO(end);

      const { data, error } = await supabase
        .from('taxa_ocupacao_dia')
        .select(`
          id,
          data,
          horario_envio,
          total_leitos,
          total_leitos_sus,
          setor_id,
          created_at,
          taxa_setores ( nome_setor, leitos_tipo, calcular_taxa ),
          taxa_ocupacao_dia_setor_leito (
            qtd_leitos_dia,
            qtd_leitos_sus,
            padrao
          )
        `)
        .gte('data', startStr)
        .lte('data', endStr);

      if (error) throw error;
      setLancamentos((data as unknown as OcupacaoDia[]) || []);
    } catch (error) {
      console.error('Erro ao buscar lançamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.')) {
      try {
        const { error } = await supabase.from('taxa_ocupacao_dia').delete().eq('id', id);
        if (error) throw error;
        // Refresh
        fetchLancamentos(currentDate);
      } catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        alert('Erro ao excluir lançamento. Tente novamente.');
      }
    }
  };

  // --- Calendar Logic ---
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDateStr(null);
    setSelectedTime(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDateStr(null);
    setSelectedTime(null);
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const calendarDays = useMemo(() => {
    const { start, end } = getMonthBoundaries(currentDate);
    const startDayOfWeek = start.getDay(); // 0 = Sun
    const totalDays = end.getDate();

    const days = [];

    // Previous month padding
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthEnd - i,
        isCurrentMonth: false,
        dateStr: formatToLocalISO(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd - i))
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        dateStr: formatToLocalISO(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
      });
    }

    // Next month padding to fill rows of 7
    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        dateStr: formatToLocalISO(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i))
      });
    }

    return days;
  }, [currentDate]);

  // Group launches by date and time
  const groupedLancamentos = useMemo(() => {
    const grouped: Record<string, { '10:00': boolean, '20:00': boolean }> = {};
    lancamentos.forEach(l => {
      if (!grouped[l.data]) {
        grouped[l.data] = { '10:00': false, '20:00': false };
      }
      if (l.horario_envio === '10:00') grouped[l.data]['10:00'] = true;
      if (l.horario_envio === '20:00') grouped[l.data]['20:00'] = true;
    });
    return grouped;
  }, [lancamentos]);

  // Data for Side Panel
  const panelRecords = useMemo(() => {
    if (!selectedDateStr || !selectedTime) return [];
    let filtered = lancamentos.filter(l => l.data === selectedDateStr && l.horario_envio === selectedTime);

    if (filterCategoria === 'SUS') {
      filtered = filtered.filter(l => l.taxa_setores?.leitos_tipo === 'SUS');
    } else if (filterCategoria === 'Geral') {
      filtered = filtered.filter(l =>
        (l.taxa_setores?.leitos_tipo === 'SUS' && l.taxa_setores?.calcular_taxa === 'Ambos') ||
        (l.taxa_setores?.leitos_tipo === 'Particular ou convênio' && l.taxa_setores?.calcular_taxa === 'Geral') ||
        (l.taxa_setores?.leitos_tipo === 'Ambos' && l.taxa_setores?.calcular_taxa === 'Geral')
      );
    }

    return filtered;
  }, [selectedDateStr, selectedTime, lancamentos, filterCategoria]);

  return (
    <div className="flex flex-1 flex-col gap-6 w-full animate-in fade-in zoom-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Lançamento de Taxas
          </h1>
          <p className="text-muted-foreground text-sm">
            Selecione uma data e horário no calendário para visualizar os registros ou crie um novo.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setIsBubbleModalOpen(true)}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
          >
            <Database className="h-4 w-4" />
            Sincronizar Bubble
          </button>
          <button
            onClick={() => navigate('/taxa-ocupacao/lancamento-taxas/novo')}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap shadow-sm hover:shadow"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">

        {/* Left Column: Calendar */}
        <div className="w-full lg:w-[470px] xl:w-[520px] bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col shrink-0">
          <div className="p-4 border-b flex items-center justify-between bg-muted/20">
            <h2 className="text-lg font-bold text-foreground">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div className="flex gap-2">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-muted rounded-md transition-colors" title="Mês Anterior">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-muted rounded-md transition-colors" title="Próximo Mês">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-4 flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {weekDays.map(day => (
                    <div key={day} className="text-center text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
                  {calendarDays.map((calDay, idx) => {
                    const dayData = groupedLancamentos[calDay.dateStr];
                    const isToday = calDay.dateStr === formatToLocalISO(new Date());

                    return (
                      <div
                        key={idx}
                        className={`min-h-[80px] border rounded-md p-1.5 flex flex-col gap-1 transition-colors ${calDay.isCurrentMonth ? 'bg-background' : 'bg-muted/30 opacity-50'
                          } ${isToday ? 'border-primary/50 bg-primary/5' : ''}`}
                      >
                        <div className="text-right">
                          <span className={`text-sm font-medium ${isToday ? 'bg-primary text-primary-foreground px-2 py-0.5 rounded-full' : 'text-foreground'}`}>
                            {calDay.day}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 mt-1">
                          {dayData?.['10:00'] && (
                            <button
                              onClick={() => {
                                setSelectedDateStr(calDay.dateStr);
                                setSelectedTime('10:00');
                              }}
                              className={`text-xs px-2 py-1 rounded-full w-full text-center flex items-center justify-center gap-1 font-bold transition-all ${selectedDateStr === calDay.dateStr && selectedTime === '10:00'
                                  ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)] [text-shadow:0_0_8px_currentColor]'
                                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-transparent hover:bg-yellow-500/20 [text-shadow:0_0_4px_currentColor]'
                                }`}
                            >
                              <Clock className="h-3 w-3" />
                              10:00
                            </button>
                          )}

                          {dayData?.['20:00'] && (
                            <button
                              onClick={() => {
                                setSelectedDateStr(calDay.dateStr);
                                setSelectedTime('20:00');
                              }}
                              className={`text-xs px-2 py-1 rounded-full w-full text-center flex items-center justify-center gap-1 font-bold transition-all ${selectedDateStr === calDay.dateStr && selectedTime === '20:00'
                                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)] [text-shadow:0_0_8px_currentColor]'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-transparent hover:bg-blue-500/20 [text-shadow:0_0_4px_currentColor]'
                                }`}
                            >
                              <Clock className="h-3 w-3" />
                              20:00
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Details Panel */}
        <div className="flex-1 bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Lançamentos de Taxas do dia</h2>
              {selectedDateStr && selectedTime ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <CalendarIcon className="h-4 w-4" />
                  {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('pt-BR')}
                  <span className="mx-1">•</span>
                  <Clock className="h-4 w-4" />
                  {selectedTime}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione um horário no calendário para ver os detalhes.
                </p>
              )}
            </div>

            {selectedDateStr && selectedTime && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Categoria:</span>
                <select
                  value={filterCategoria}
                  onChange={(e) => setFilterCategoria(e.target.value)}
                  className="text-xs bg-background border rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                >
                  <option value="Geral">Geral</option>
                  <option value="SUS">SUS</option>
                </select>
              </div>
            )}
          </div>

          <div className="p-4 flex-1 overflow-auto bg-muted/5">
            {!selectedDateStr || !selectedTime ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 opacity-50 p-6 text-center">
                <CalendarIcon className="h-12 w-12" />
                <p>Nenhum dia/horário selecionado</p>
              </div>
            ) : panelRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 p-6 text-center">
                <AlertCircle className="h-10 w-10 text-yellow-500/50" />
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

                      // Isolados: soma (qtd_leitos_dia + qtd_leitos_sus) onde padrao é false
                      const isolados = detalhes
                        .filter(d => d.padrao === false)
                        .reduce((acc, curr) => acc + Number(curr.qtd_leitos_dia || 0) + Number(curr.qtd_leitos_sus || 0), 0);

                      // Se o setor for tipo SUS, usa total_leitos_sus como base
                      const isSUS = record.taxa_setores?.leitos_tipo === 'SUS';
                      const baseLeitosExibicao = isSUS ? Number(record.total_leitos_sus || 0) : Number(record.total_leitos || 0);

                      const leitosLivres = Math.max(0, baseLeitosExibicao - totalOcupados);
                      const leitosDisponiveis = leitosLivres;
                      const taxaOcupacao = baseLeitosExibicao > 0 ? Math.min(100, (totalOcupados / baseLeitosExibicao) * 100) : 0;

                      const dataAtual = new Date(record.created_at);
                      const atualTime = `${String(dataAtual.getHours()).padStart(2, '0')}:${String(dataAtual.getMinutes()).padStart(2, '0')}`;

                      return (
                        <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-2 py-2 font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={record.taxa_setores?.nome_setor} onClick={() => navigate(`/taxa-ocupacao/lancamento-taxas/editar/${record.id}`)}>
                            <div className="flex flex-col cursor-pointer">
                              <span className="truncate">{record.taxa_setores?.nome_setor}</span>
                              {record.taxa_setores?.leitos_tipo && (
                                <span className="inline-flex w-fit px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-tight mt-0.5">
                                  {record.taxa_setores?.leitos_tipo}
                                </span>
                              )}
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

      <BubbleSyncModal
        isOpen={isBubbleModalOpen}
        onClose={() => setIsBubbleModalOpen(false)}
        onSuccess={fetchLancamentos}
      />
    </div>
  );
};

export default LancamentoTaxas;
