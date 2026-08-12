import React from 'react';
import { SurveyVolumeChart } from './SurveyVolumeChart';
import { NpsVolumeChart } from './NpsVolumeChart';
import { SurveyVolumePoint } from './types';

interface SecondaryChartsGridProps {
  volumeData: SurveyVolumePoint[];
}

export const SecondaryChartsGrid: React.FC<SecondaryChartsGridProps> = ({ volumeData }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card rounded-2xl p-6 shadow-xs border border-border flex flex-col justify-between">
        <div className="mb-2">
          <h3 className="text-base font-bold text-foreground">Volume Diário de Pesquisas</h3>
          <p className="text-xs text-muted-foreground font-medium">Quantidade total de participações enviadas por dia</p>
        </div>

        <SurveyVolumeChart data={volumeData} />
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-xs border border-border flex flex-col justify-between">
        <div className="mb-2">
          <h3 className="text-base font-bold text-foreground">NPS x Volume de Respostas</h3>
          <p className="text-xs text-muted-foreground font-medium">Contexto estatístico entre a nota NPS e o tamanho da amostra</p>
        </div>

        <NpsVolumeChart data={volumeData} />
      </div>
    </div>
  );
};
