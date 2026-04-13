import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { DashboardData } from '../../services/dashboardService';

interface AdminChartsProps {
  data: DashboardData;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

// Helper: converte "MM/YYYY" para Date para ordenação
const parseMesAno = (mesAno: string) => {
  const [m, y] = mesAno.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, 1);
};

export const AdminCharts: React.FC<AdminChartsProps> = ({ data }) => {
  // 1. Evolução da Folha de Pagamento (Agrupado por mes_ano)
  const payrollData = useMemo(() => {
    const grouped = data.holerites.reduce((acc, curr) => {
      if (!curr.mes_ano || curr.total_liquido === null) return acc;
      acc[curr.mes_ano] = (acc[curr.mes_ano] || 0) + Number(curr.total_liquido);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([mes_ano, total]) => ({
        mes_ano,
        total,
        date: parseMesAno(mes_ano).getTime(),
      }))
      .sort((a, b) => a.date - b.date) // Ordena cronologicamente
      .slice(-12); // Pega últimos 12 meses
  }, [data.holerites]);

  // 2. Status de E-mails
  const { emailData, taxaEnvio } = useMemo(() => {
    let sent = 0;
    let pending = 0;
    data.holerites.forEach(h => h.email_enviado_em ? sent++ : pending++);
    data.informes.forEach(i => i.email_enviado_em ? sent++ : pending++);
    const total = sent + pending;
    const taxaEnvio = total > 0 ? ((sent / total) * 100).toFixed(0) : '0';
    return {
      emailData: [
        { name: 'Enviados', value: sent, color: '#3b82f6' }, // blue-500
        { name: 'Pendentes', value: pending, color: '#f43f5e' } // rose-500
      ],
      taxaEnvio
    };
  }, [data]);

  // 3. Volume de Importações por Mês (Baseado no created_at)
  const volumeData = useMemo(() => {
    const grouped: Record<string, { holerites: number, informes: number }> = {};
    
    const addToGroup = (dateString: string | undefined, type: 'holerites' | 'informes') => {
      if (!dateString) return;
      const date = new Date(dateString);
      const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      if (!grouped[key]) grouped[key] = { holerites: 0, informes: 0, date: new Date(date.getFullYear(), date.getMonth(), 1).getTime() } as any;
      grouped[key][type]++;
    };

    data.holerites.forEach(h => addToGroup(h.created_at, 'holerites'));
    data.informes.forEach(i => addToGroup(i.created_at, 'informes'));

    return Object.entries(grouped)
      .map(([mes, counts]) => ({ name: mes, ...counts }))
      .sort((a: any, b: any) => a.date - b.date)
      .slice(-6); // Últimos 6 meses
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gráfico 1: Evolução da Folha (Ocupa 2 colunas em telas grandes) */}
      <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border flex flex-col shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">Evolução da Folha (Líquida)</h3>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={payrollData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#52525b" opacity={0.4} />
              <XAxis dataKey="mes_ano" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatCurrency} stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Total Líquido']}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: E-mails */}
      <div className="bg-card p-6 rounded-xl border border-border flex flex-col shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">Eficiência de Comunicação</h3>
        <div className="flex-1 min-h-[300px] flex items-center justify-center relative">
          {emailData[0].value === 0 && emailData[1].value === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento processado.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <text 
                  x="50%" 
                  y="45%" 
                  textAnchor="middle" 
                  dominantBaseline="middle" 
                  className="fill-foreground text-4xl font-bold font-sans"
                >
                  {`${taxaEnvio}%`}
                </text>
                <text 
                  x="50%" 
                  y="55%" 
                  textAnchor="middle" 
                  dominantBaseline="middle" 
                  className="fill-muted-foreground text-xs font-medium"
                >
                  Entregues
                </text>

                <Pie
                  data={emailData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  cornerRadius={10}
                  dataKey="value"
                  stroke="none"
                >
                  {emailData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico 3: Volume */}
      <div className="lg:col-span-3 bg-card p-6 rounded-xl border border-border flex flex-col shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">Volume de Indexação (Gerados no Banco)</h3>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#52525b" opacity={0.4} />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }}/>
              <Bar dataKey="holerites" name="Holerites" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="informes" name="Informes de IR" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
