import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, FileText, Receipt } from 'lucide-react';
import { DashboardData } from '../../services/dashboardService';

interface UserChartsProps {
  data: DashboardData;
  hideValues: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

const parseMesAno = (mesAno: string) => {
  const [m, y] = mesAno.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, 1);
};

export const UserCharts: React.FC<UserChartsProps> = ({ data, hideValues }) => {
  // Evolução Salarial do Colaborador
  const myPayrollData = useMemo(() => {
    return data.holerites
      .filter(h => h.total_liquido !== null)
      .map(h => ({
        mes_ano: h.mes_ano,
        total: h.total_liquido,
        date: parseMesAno(h.mes_ano).getTime(),
      }))
      .sort((a, b) => a.date - b.date)
      .slice(-12);
  }, [data.holerites]);

  // Últimos 3 holerites
  const recentHolerites = useMemo(() => {
    return [...data.holerites]
      .sort((a, b) => {
        const dateA = parseMesAno(a.mes_ano).getTime();
        const dateB = parseMesAno(b.mes_ano).getTime();
        return dateB - dateA; // Descending
      })
      .slice(0, 4);
  }, [data.holerites]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gráfico 1: Evolução Salarial (Ocupa 2 colunas) */}
      <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border flex flex-col shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-foreground">Minha Evolução Salarial</h3>
        </div>
        
        {myPayrollData.length === 0 ? (
          <div className="flex-1 min-h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            Histórico insuficiente para gerar o gráfico.
          </div>
        ) : (
          <div className="flex-1 min-h-[300px] relative">
             {hideValues && (
                <div className="absolute inset-0 z-10 backdrop-blur-sm bg-background/30 flex items-center justify-center rounded-lg border border-border/50">
                  <span className="bg-background px-4 py-2 rounded-full text-sm font-medium border border-border shadow-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Valores ofuscados por privacidade
                  </span>
                </div>
              )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={myPayrollData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotalUser" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes_ano" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatCurrency} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={80} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Valor Líquido']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotalUser)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Lista 2: Holerites Recentes */}
      <div className="bg-card p-6 rounded-xl border border-border flex flex-col shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">Holerites Recentes</h3>
        
        {recentHolerites.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Receipt className="h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhum documento encontrado.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {recentHolerites.map((holerite) => (
              <div key={holerite.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Ref: {holerite.mes_ano}</h4>
                    {holerite.email_enviado_em ? (
                       <span className="text-xs text-green-600 dark:text-green-400 font-medium">Notificado</span>
                    ) : (
                       <span className="text-xs text-muted-foreground">Adicionado</span>
                    )}
                  </div>
                </div>
                {holerite.pdf_url ? (
                  <a 
                    href={holerite.pdf_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
                    title="Baixar PDF"
                  >
                    <Download className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  </a>
                ) : (
                   <span className="text-xs text-muted-foreground italic px-2">Anexo indisp.</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
