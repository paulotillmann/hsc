import React from 'react';
import { DashboardKpis } from './types';

interface NpsDistributionChartProps {
  kpis: DashboardKpis;
}

export const NpsDistributionChart: React.FC<NpsDistributionChartProps> = ({ kpis }) => {
  const { promotersCount, neutralsCount, detractorsCount, promotersPct, neutralsPct, detractorsPct, npsScore } = kpis;
  const total = promotersCount + neutralsCount + detractorsCount;

  if (total === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm font-semibold">
        Sem dados de distribuição no período.
      </div>
    );
  }

  const radius = 70;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  const promotersDash = (promotersPct / 100) * circumference;
  const neutralsDash = (neutralsPct / 100) * circumference;
  const detractorsDash = (detractorsPct / 100) * circumference;

  const promotersOffset = 0;
  const neutralsOffset = -promotersDash;
  const detractorsOffset = -(promotersDash + neutralsDash);

  return (
    <div className="flex flex-col items-center justify-between h-full space-y-4">
      <div className="relative w-48 h-48 flex items-center justify-center my-2">
        <svg viewBox="0 0 180 180" className="w-full h-full transform -rotate-90">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />

          {promotersPct > 0 && (
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#10B981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${promotersDash} ${circumference}`}
              strokeDashoffset={promotersOffset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
            />
          )}

          {neutralsPct > 0 && (
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#F59E0B"
              strokeWidth={strokeWidth}
              strokeDasharray={`${neutralsDash} ${circumference}`}
              strokeDashoffset={neutralsOffset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
            />
          )}

          {detractorsPct > 0 && (
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#EF4444"
              strokeWidth={strokeWidth}
              strokeDasharray={`${detractorsDash} ${circumference}`}
              strokeDashoffset={detractorsOffset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            NPS
          </span>
          <span className="text-3xl font-black text-foreground tracking-tight">
            {npsScore > 0 ? `+${npsScore}` : npsScore}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">
            {total} respostas
          </span>
        </div>
      </div>

      <div className="w-full space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-foreground">Promotores (9-10)</span>
          </div>
          <div className="font-bold text-foreground">
            {promotersCount} <span className="text-muted-foreground font-normal">({promotersPct}%)</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="font-semibold text-foreground">Neutros (7-8)</span>
          </div>
          <div className="font-bold text-foreground">
            {neutralsCount} <span className="text-muted-foreground font-normal">({neutralsPct}%)</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="font-semibold text-foreground">Detratores (0-6)</span>
          </div>
          <div className="font-bold text-foreground">
            {detractorsCount} <span className="text-muted-foreground font-normal">({detractorsPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
