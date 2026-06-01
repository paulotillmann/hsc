import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  Activity, 
  BedDouble, 
  UserCheck, 
  DoorOpen, 
  ClipboardList, 
  History, 
  Calendar, 
  RefreshCw,
  PieChart as PieIcon,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buscarPacientes } from '../../services/pacienteService';
import { VisaoGeralCard } from '../../components/recepcao/VisaoGeralCard';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

export default function VisaoGeral() {
  const [loading, setLoading] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);

  // Dynamic Theme Detection for Recharts Tooltips
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Cards state
  const [pacientesCount, setPacientesCount] = useState(0);
  const [totalVisitsToday, setTotalVisitsToday] = useState(0);
  const [currentCompanions, setCurrentCompanions] = useState(0);
  const [totalVisitorsToday, setTotalVisitorsToday] = useState(0);
  const [currentVisitors, setCurrentVisitors] = useState(0);
  const [totalThirdsToday, setTotalThirdsToday] = useState(0);

  // Filter & Chart states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [weeklyDataset, setWeeklyDataset] = useState<any[]>([]);
  const [monthlyDataset, setMonthlyDataset] = useState<any[]>([]);
  const [donutDataset, setDonutDataset] = useState<any[]>([]);
  const [totalMonthVisits, setTotalMonthVisits] = useState(0);
  const [totalWeekVisits, setTotalWeekVisits] = useState(0);

  // Generate the last 12 months for the period filter
  const monthsOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const label = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      options.push({ 
        label: label.charAt(0).toUpperCase() + label.slice(1), 
        value 
      });
    }
    return options;
  }, []);

  // Cohesive dark-red/burgundy color palette matching the brand color
  const COLORS = ['#8a1515', '#b91c1c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'];

  // Load KPIs data (optimized count queries)
  const loadKpis = async () => {
    setLoading(true);
    try {
      const today = new Date();
      // Start and end of today in local time range format
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
      const threeDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3, 0, 0, 0, 0).toISOString();

      const [
        patientsList,
        totalVisitsTodayRes,
        currentCompanionsRes,
        totalVisitorsTodayRes,
        currentVisitorsRes,
        totalThirdsTodayRes
      ] = await Promise.all([
        buscarPacientes(),
        supabase.from('visitas').select('id', { count: 'exact', head: true }).gte('data_hora_entrada', start).lte('data_hora_entrada', end),
        supabase.from('visitas').select('id', { count: 'exact', head: true }).ilike('identificado_como', 'ACOMPANHANTE').is('data_hora_saida', null).gte('data_hora_entrada', threeDaysAgo),
        supabase.from('visitas').select('id', { count: 'exact', head: true }).ilike('identificado_como', 'VISITANTE').gte('data_hora_entrada', start).lte('data_hora_entrada', end),
        supabase.from('visitas').select('id', { count: 'exact', head: true }).ilike('identificado_como', 'VISITANTE').is('data_hora_saida', null),
        supabase.from('visitas').select('id', { count: 'exact', head: true }).ilike('identificado_como', 'TERCEIRO').gte('data_hora_entrada', start).lte('data_hora_entrada', end)
      ]);

      setPacientesCount(patientsList.length);
      setTotalVisitsToday(totalVisitsTodayRes.count ?? 0);
      setCurrentCompanions(currentCompanionsRes.count ?? 0);
      setTotalVisitorsToday(totalVisitorsTodayRes.count ?? 0);
      setCurrentVisitors(currentVisitorsRes.count ?? 0);
      setTotalThirdsToday(totalThirdsTodayRes.count ?? 0);
    } catch (err) {
      console.error('Erro ao buscar KPIs de visão geral:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load weekly & monthly chart data using server-side SQL Aggregation (RPC) to bypass REST row-limits
  const loadChartsData = async () => {
    setLoadingCharts(true);
    try {
      // 1. Get the Monday of the current week (Monday to Sunday)
      const startOfWeek = new Date();
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Selected Month dates
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const daysInMonth = new Date(year, month, 0).getDate();

      const startOfMonth = `${yearStr}-${monthStr}-01T00:00:00.000Z`;
      const endOfMonth = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`;

      // Query aggregated charts data via RPC functions (Server-Side Group By)
      const [weekRes, dailyRes, atendentesRes] = await Promise.all([
        supabase.rpc('get_visits_by_type_and_date', { 
          p_start_date: startOfWeek.toISOString(), 
          p_end_date: endOfWeek.toISOString() 
        }),
        supabase.rpc('get_daily_visits', { 
          p_start_date: startOfMonth, 
          p_end_date: endOfMonth 
        }),
        supabase.rpc('get_atendente_visits', { 
          p_start_date: startOfWeek.toISOString(), 
          p_end_date: endOfWeek.toISOString() 
        })
      ]);

      if (weekRes.error) throw weekRes.error;
      if (dailyRes.error) throw dailyRes.error;
      if (atendentesRes.error) throw atendentesRes.error;

      const weekVisitsData = weekRes.data || [];
      const dailyVisitsData = dailyRes.data || [];
      const atendenteVisitsData = atendentesRes.data || [];

      // ── Process Weekly Dataset (Grouped by Day and Type) ──
      const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      const processedWeek = diasSemana.map((dia, index) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + index);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dateDay = String(d.getDate()).padStart(2, '0');
        const dateString = `${y}-${m}-${dateDay}`; // YYYY-MM-DD

        const dayRows = weekVisitsData.filter((r: any) => r.dia === dateString);
        
        const acompanhantes = dayRows
          .filter((r: any) => r.tipo.toUpperCase() === 'ACOMPANHANTE')
          .reduce((acc: number, r: any) => acc + parseInt(r.total, 10), 0);
          
        const visitantes = dayRows
          .filter((r: any) => r.tipo.toUpperCase() === 'VISITANTE')
          .reduce((acc: number, r: any) => acc + parseInt(r.total, 10), 0);

        return {
          name: dia,
          Acompanhantes: acompanhantes,
          Visitantes: visitantes
        };
      });
      setWeeklyDataset(processedWeek);

      // ── Process Donut Dataset (Grouped by Atendente First Name - Week Limit) ──
      let totalWeek = 0;
      const userCounts: Record<string, number> = {};
      
      atendenteVisitsData.forEach((r: any) => {
        const count = parseInt(r.total_visitas, 10);
        totalWeek += count;
        
        const atendente = r.atendente_name ? r.atendente_name.trim() : 'Não Informado';
        const firstName = atendente.split(' ')[0] || 'Não Informado';
        const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        
        userCounts[formattedName] = (userCounts[formattedName] || 0) + count;
      });

      setTotalWeekVisits(totalWeek);

      const sortedUsers = Object.entries(userCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const topUsers = sortedUsers.slice(0, 6);
      const otherCount = sortedUsers.slice(6).reduce((acc, curr) => acc + curr.value, 0);
      if (otherCount > 0) {
        topUsers.push({ name: 'Outros', value: otherCount });
      }
      setDonutDataset(topUsers);

      // ── Process Monthly Dataset (Daily total) ──
      const processedMonth = Array.from({ length: daysInMonth }, (_, index) => {
        const dayNum = index + 1;
        const dayString = `${yearStr}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
        
        const matchingRow = dailyVisitsData.find((r: any) => r.dia === dayString);
        const count = matchingRow ? parseInt(matchingRow.total_visitas, 10) : 0;
        
        return {
          day: String(dayNum),
          Visitas: count
        };
      });
      setMonthlyDataset(processedMonth);

    } catch (err) {
      console.error('Erro ao buscar dados dos gráficos:', err);
    } finally {
      setLoadingCharts(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  useEffect(() => {
    loadChartsData();
  }, [selectedMonth]);

  const handleRefresh = () => {
    loadKpis();
    loadChartsData();
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 md:p-8 animate-in fade-in zoom-in duration-500 bg-background text-foreground pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-2xl border border-red-500/20 text-[#8a1515] dark:text-[#f43f5e] shadow-[0_0_15px_rgba(138,21,21,0.1)]">
              <Activity className="h-6 w-6" />
            </div>
            Recepção: Visão Geral
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe em tempo real os dados de visitas, acompanhantes, prestadores de serviço e pacientes internados.
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          className="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all border border-border bg-card hover:bg-muted text-foreground px-4 py-2.5 shadow-md flex-shrink-0 cursor-pointer gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading || loadingCharts ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* KPIs GRID (Layout inspirado no Anexo 1 - Suporta modo Claro e Escuro) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        <VisaoGeralCard 
          title="Pacientes Internados" 
          value={pacientesCount} 
          icon={BedDouble} 
          subtext="🏨 Em leitos/apartamentos"
          subtextColorClass="text-red-700 dark:text-red-400"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Visitas no Dia" 
          value={totalVisitsToday} 
          icon={ClipboardList} 
          subtext="↗ Registros efetuados hoje"
          subtextColorClass="text-rose-600 dark:text-rose-400"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Acompanhantes Atuais" 
          value={currentCompanions} 
          icon={Users} 
          subtext="👥 Presentes no hospital"
          subtextColorClass="text-red-800 dark:text-[#fda4af]"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Visitantes no Dia" 
          value={totalVisitorsToday} 
          icon={UserCheck} 
          subtext="👤 Total registrado hoje"
          subtextColorClass="text-rose-700 dark:text-rose-300"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Visitantes Atuais" 
          value={currentVisitors} 
          icon={DoorOpen} 
          subtext="🚪 Em visita neste momento"
          subtextColorClass="text-red-600 dark:text-[#fecdd3]"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Terceiros no Dia" 
          value={totalThirdsToday} 
          icon={History} 
          subtext="⚙️ Prestadores de serviço hoje"
          subtextColorClass="text-rose-800 dark:text-rose-500"
          isLoading={loading}
        />
      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Acompanhantes vs Visitantes Semanal (Barras Verticais lado a lado em tons de Vermelho) */}
        <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border flex flex-col shadow-md dark:shadow-xl min-h-[420px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#8a1515]" />
                Comparativo Semanal (Segunda a Domingo)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Quantidade diária de acompanhantes e visitantes da semana atual.
              </p>
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            {loadingCharts ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-red-700 border-t-transparent animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando dados semanais...</span>
              </div>
            ) : weeklyDataset.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum dado encontrado para a semana atual.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyDataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1f293d' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'var(--border)', 
                      borderRadius: '12px',
                      color: 'var(--card-foreground)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
                  />
                  <Bar dataKey="Acompanhantes" name="Acompanhantes" fill="#8a1515" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Visitantes" name="Visitantes" fill="#fb7185" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Rosca de Atendentes (Donut - Modelo do Anexo 2 em Tons Monocromáticos Vermelhos) */}
        <div className="bg-card p-6 rounded-2xl border border-border flex flex-col shadow-md dark:shadow-xl min-h-[420px]">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-[#8a1515]" />
              Cadastro de Visitas por Usuário
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Participação de cada atendente nos cadastros da semana atual.
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
            {loadingCharts ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-red-700 border-t-transparent animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando dados de atendentes...</span>
              </div>
            ) : donutDataset.length === 0 ? (
              <span className="text-sm text-muted-foreground">Nenhum cadastro nesta semana.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <text 
                    x="50%" 
                    y="43%" 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    className="fill-foreground text-3xl font-extrabold font-sans"
                  >
                    {totalWeekVisits}
                  </text>
                  <text 
                    x="50%" 
                    y="53%" 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    className="fill-muted-foreground text-[11px] font-bold uppercase tracking-wider"
                  >
                    Acessos
                  </text>

                  <Pie
                    data={donutDataset}
                    cx="50%"
                    cy="48%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={4}
                    cornerRadius={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutDataset.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'var(--border)', 
                      borderRadius: '12px',
                      color: 'var(--card-foreground)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 3: Volume Diário no Mês (Barra Vermelha Estilizada) */}
        <div className="lg:col-span-3 bg-card p-6 rounded-2xl border border-border flex flex-col shadow-md dark:shadow-xl min-h-[400px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#8a1515]" />
                Histórico Diário de Acessos
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Volume total de visitas registradas em cada dia do mês selecionado.
              </p>
            </div>

            {/* Elegant Period Picker */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Período:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-muted border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:border-border/80 transition-all shadow-sm"
              >
                {monthsOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-[280px]">
            {loadingCharts ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-red-700 border-t-transparent animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando dados mensais...</span>
              </div>
            ) : monthlyDataset.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum dado encontrado para o mês selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1f293d' : '#e2e8f0'} />
                  <XAxis dataKey="day" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'var(--border)', 
                      borderRadius: '12px',
                      color: 'var(--card-foreground)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="Visitas" name="Visitas" fill="#8a1515" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
