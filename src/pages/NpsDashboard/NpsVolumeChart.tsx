import React from 'react';
import { SurveyVolumePoint } from './types';

interface NpsVolumeChartProps {
  data: SurveyVolumePoint[];
}

export const NpsVolumeChart: React.FC<NpsVolumeChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-xs font-semibold">
        Sem dados combinados no período.
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="w-full space-y-3">
      <div className="h-44 flex items-end justify-between gap-2 pt-4 px-2">
        {data.map((item) => {
          const heightPct = (item.total / maxTotal) * 100;
          return (
            <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip no Hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-all absolute -top-10 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md z-10 whitespace-nowrap pointer-events-none">
                {item.label}: {item.total} resp. (NPS: {item.npsScore > 0 ? `+${item.npsScore}` : item.npsScore})
              </div>

              {/* Tag NPS sobre a barra */}
              <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 mb-0.5">
                {item.npsScore > 0 ? `+${item.npsScore}` : item.npsScore}
              </span>

              {/* Trilho da Barra */}
              <div className="w-full max-w-[28px] bg-slate-200/50 dark:bg-slate-800/50 rounded-t-lg overflow-hidden flex flex-col justify-end h-28">
                {/* Barra Ativa */}
                <div
                  className="w-full bg-blue-600 dark:bg-blue-500 hover:bg-blue-400 rounded-t-lg transition-all duration-300"
                  style={{ height: `${Math.max(heightPct, 8)}%` }}
                ></div>
              </div>

              {/* Data Label */}
              <span className="text-[10px] font-bold text-muted-foreground truncate max-w-full">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
