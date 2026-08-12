import React from 'react';
import { NpsEvolutionChart } from './NpsEvolutionChart';
import { NpsDistributionChart } from './NpsDistributionChart';
import { NpsEvolutionPoint, DashboardKpis } from './types';

interface MainChartsGridProps {
  evolutionData: NpsEvolutionPoint[];
  kpis: DashboardKpis;
}

export const MainChartsGrid: React.FC<MainChartsGridProps> = ({ evolutionData, kpis }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-xs border border-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Evolução do NPS no Período</h3>
            <p className="text-xs text-muted-foreground font-medium">Histórico diário da pontuação NPS (-100 a +100)</p>
          </div>
        </div>

        <NpsEvolutionChart data={evolutionData} />
      </div>

      <div className="lg:col-span-1 bg-card rounded-2xl p-6 shadow-xs border border-border flex flex-col justify-between">
        <div className="mb-2">
          <h3 className="text-base font-bold text-foreground">Distribuição das Respostas</h3>
          <p className="text-xs text-muted-foreground font-medium">Proporção entre Promotores, Neutros e Detratores</p>
        </div>

        <NpsDistributionChart kpis={kpis} />
      </div>
    </div>
  );
};
