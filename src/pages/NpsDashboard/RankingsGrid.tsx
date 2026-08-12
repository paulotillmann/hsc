import React from 'react';
import { Award, AlertTriangle } from 'lucide-react';
import { RankingItem } from './types';

interface RankingsGridProps {
  bestRankings: RankingItem[];
  attentionRankings: RankingItem[];
}

export const RankingsGrid: React.FC<RankingsGridProps> = ({ bestRankings, attentionRankings }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card rounded-2xl p-6 shadow-xs border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Melhores Avaliações (Pontos Fortes)</h3>
              <p className="text-xs text-muted-foreground font-medium">Aspectos com maior índice de satisfação do paciente</p>
            </div>
          </div>

          {bestRankings.length === 0 ? (
            <p className="text-xs text-muted-foreground font-semibold text-center py-6">Sem dados suficientes para melhores avaliações.</p>
          ) : (
            <div className="space-y-3">
              {bestRankings.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0 self-center leading-none text-center">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col justify-center">
                      <p className="text-xs font-bold text-foreground leading-tight">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground font-medium leading-tight mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-center ml-3 self-center">
                    <span className="inline-flex items-center justify-center min-w-[56px] h-8 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 px-3 rounded-xl text-center leading-none">
                      {item.scorePct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-xs border border-amber-100 dark:border-amber-900/30 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Pontos de Atenção (Oportunidades)</h3>
              <p className="text-xs text-muted-foreground font-medium">Aspectos que requerem monitoramento ou melhoria gerencial</p>
            </div>
          </div>

          {attentionRankings.length === 0 ? (
            <div className="bg-muted p-4 rounded-xl text-center text-xs text-muted-foreground font-semibold">
              Excelente! Nenhum ponto crítico identificado no período selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {attentionRankings.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center shrink-0 self-center leading-none text-center">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col justify-center">
                      <p className="text-xs font-bold text-foreground leading-tight">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground font-medium leading-tight mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-center ml-3 self-center">
                    <span className="inline-flex items-center justify-center min-w-[56px] h-8 text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 px-3 rounded-xl text-center leading-none">
                      {item.scorePct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
