import React, { useEffect, useState, useMemo } from 'react';
import { Users, DollarSign, Target, FileStack, Eye, EyeOff, FileText, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { fetchDashboardData, DashboardData } from '../services/dashboardService';
import { StatCard } from '../components/dashboard/StatCard';
import { AdminCharts } from '../components/dashboard/AdminCharts';
import { UserCharts } from '../components/dashboard/UserCharts';

const parseMesAno = (mesAno: string) => {
  const [m, y] = mesAno.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, 1);
};

export default function Dashboard() {
  const { profile, profileLoaded } = useAuth();
  const { can } = usePermissions();
  
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({ holerites: [], informes: [] });
  const [hideValues, setHideValues] = useState(false); // Colaborador offuscar

  const isAdminView = can('can_view_all');

  useEffect(() => {
    async function loadData() {
      if (!profileLoaded) return;
      
      setIsLoading(true);
      try {
        const result = await fetchDashboardData();
        setData(result);
      } catch (error) {
        console.error("Erro ao carregar dashboard", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [profileLoaded]);

  // --- KPIs ADMIN ---
  const adminKpis = useMemo(() => {
    if (!isAdminView) return null;
    const cpfSet = new Set(data.holerites.map(h => h.cpf));
    
    // Pegar mês mais recente
    let currentMonthStr = "";
    let maxDate = 0;
    data.holerites.forEach(h => {
      const d = parseMesAno(h.mes_ano).getTime();
      if (d > maxDate) { maxDate = d; currentMonthStr = h.mes_ano; }
    });

    const totalLiquidoMes = data.holerites
      .filter(h => h.mes_ano === currentMonthStr)
      .reduce((acc, curr) => acc + Number(curr.total_liquido || 0), 0);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    let sent = 0; let pend = 0;
    data.holerites.forEach(h => h.email_enviado_em ? sent++ : pend++);
    const taxaEnvio = (sent + pend) > 0 ? (sent / (sent + pend)) * 100 : 0;

    return {
      totalColaboradores: cpfSet.size,
      massaSalarial: formatCurrency(totalLiquidoMes),
      massaRef: currentMonthStr,
      taxaDeEnvio: taxaEnvio.toFixed(1) + "%",
      totalDocumentos: data.holerites.length + data.informes.length
    };
  }, [data, isAdminView]);

  // --- KPIs USER ---
  const userKpis = useMemo(() => {
    if (isAdminView) return null;
    
    // Sort holerites para pegar o último
    const sortedH = [...data.holerites].sort((a,b) => parseMesAno(b.mes_ano).getTime() - parseMesAno(a.mes_ano).getTime());
    const lastHolerite = sortedH[0];

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(val);
    
    // Checar se existe informe do ano passado
    const anoPassado = new Date().getFullYear() - 1;
    const temInformeDirf = data.informes.some(i => Number(i.ano_referencia) === anoPassado);

    return {
      ultimoSalario: lastHolerite ? formatCurrency(Number(lastHolerite.total_liquido)) : 'R$ 0,00',
      ultimaRef: lastHolerite ? `Ref: ${lastHolerite.mes_ano}` : '',
      totalHolerites: data.holerites.length,
      statusInforme: temInformeDirf ? `Disponível (${anoPassado})` : 'Ainda não gerado'
    };
  }, [data, isAdminView]);

  return (
    <div className="flex-1 space-y-8 min-h-screen pb-12 w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      {/* Header Geral */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdminView 
              ? "Visão executiva e acompanhamento da folha do hospital."
              : `Bem-vindo de volta, ${profile?.full_name?.split(' ')[0] || 'Colaborador'}! Acompanhe seus recebimentos.`}
          </p>
        </div>
        
        {/* Toggle Esconder Valores (Somente Colaborador ou Admin se quiser) */}
        {!isAdminView && (
          <button
            onClick={() => setHideValues(!hideValues)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border text-sm font-medium"
          >
            {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {hideValues ? 'Mostrar Valores' : 'Ocultar Valores'}
          </button>
        )}
      </div>

      {/* Seção 1: KPIs (Stat Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {isAdminView && adminKpis ? (
          <>
            <StatCard isLoading={isLoading} title="Colaboradores (Mês Ref.)" value={adminKpis.totalColaboradores} icon={Users} description="Na base de dados" />
            <StatCard isLoading={isLoading} title="Massa Salarial Líquida" value={adminKpis.massaSalarial} icon={DollarSign} description={`Referência: ${adminKpis.massaRef}`} />
            <StatCard isLoading={isLoading} title="Eficiência de E-mails" value={adminKpis.taxaDeEnvio} icon={Target} description="Entregues este mês" />
            <StatCard isLoading={isLoading} title="Documentos Indexados" value={adminKpis.totalDocumentos} icon={FileStack} description="Ativos no sistema" />
          </>
        ) : userKpis && (
          <>
            <StatCard 
              isLoading={isLoading} 
              title="Meu Último Holerite" 
              value={hideValues ? 'R$ ****,**' : userKpis.ultimoSalario} 
              icon={DollarSign} 
              description={userKpis.ultimaRef} 
            />
            <StatCard isLoading={isLoading} title="Meus Holerites" value={userKpis.totalHolerites} icon={FileStack} description="Disponíveis para acesso" />
            <StatCard isLoading={isLoading} title="Informe Rendimentos" value={userKpis.statusInforme} icon={FileText} description="DIRF" />
          </>
        )}
      </div>

      {/* Seção 2: Gráficos e Analíticos */}
      {!isLoading && (
        <div className="mt-8 relative">
          {isAdminView ? (
            <AdminCharts data={data} />
          ) : (
            <UserCharts data={data} hideValues={hideValues} />
          )}
        </div>
      )}
    </div>
  );
}
