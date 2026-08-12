import React from 'react';
import { Star, CheckCircle } from 'lucide-react';
import { QuestionPerformance } from './types';

interface QuestionPerformanceTableProps {
  performance: QuestionPerformance[];
}

export const QuestionPerformanceTable: React.FC<QuestionPerformanceTableProps> = ({ performance }) => {
  if (!performance || performance.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 shadow-xs border border-border text-center text-muted-foreground text-sm font-semibold">
        Sem dados de avaliação de perguntas no período.
      </div>
    );
  }

  const ratingQuestions = performance.filter((p) => p.type === 'rating');
  const choiceQuestions = performance.filter((p) => p.type === 'multiple_choice');

  return (
    <div className="bg-card rounded-2xl p-6 shadow-xs border border-border space-y-6">
      <div>
        <h3 className="text-base font-bold text-foreground">Avaliação por Pergunta</h3>
        <p className="text-xs text-muted-foreground font-medium">
          Desempenho detalhado das perguntas de avaliação (escala de 1 a 5 estrelas) e escolha múltipla
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Perguntas Avaliativas (Escala 1 a 5 Estrelas)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Pergunta</th>
                <th className="py-3 px-4 text-center">Média Geral</th>
                <th className="py-3 px-4 text-center">% Positivo (4-5★)</th>
                <th className="py-3 px-4">Distribuição das Notas (1★ a 5★)</th>
                <th className="py-3 px-4 text-right">Respostas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm font-medium text-foreground">
              {ratingQuestions.map((q) => {
                const total = q.totalResponses || 1;
                const c = q.ratingCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                const pct5 = Math.round((c[5] / total) * 100);
                const pct4 = Math.round((c[4] / total) * 100);
                const pct3 = Math.round((c[3] / total) * 100);
                const pct1_2 = Math.round(((c[1] + c[2]) / total) * 100);

                return (
                  <tr key={q.questionId} className="hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4 font-semibold text-foreground max-w-xs">
                      {q.title}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-xl text-xs font-black">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span>{q.averageRating?.toFixed(1)}</span>
                        <span className="text-amber-500/80 font-normal">/ 5.0</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        {q.positivePct}% Positivo
                      </span>
                    </td>

                    <td className="py-4 px-4 min-w-[240px]">
                      <div className="space-y-1">
                        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                          <div className="bg-emerald-500 h-full" style={{ width: `${pct5}%` }} title={`5★: ${pct5}%`}></div>
                          <div className="bg-emerald-300 h-full" style={{ width: `${pct4}%` }} title={`4★: ${pct4}%`}></div>
                          <div className="bg-amber-400 h-full" style={{ width: `${pct3}%` }} title={`3★: ${pct3}%`}></div>
                          <div className="bg-rose-500 h-full" style={{ width: `${pct1_2}%` }} title={`1-2★: ${pct1_2}%`}></div>
                        </div>

                        <div className="flex justify-between text-[10px] text-muted-foreground font-bold px-0.5">
                          <span className="text-emerald-700">5★: {pct5}%</span>
                          <span className="text-emerald-600">4★: {pct4}%</span>
                          <span className="text-amber-600">3★: {pct3}%</span>
                          <span className="text-rose-600">1-2★: {pct1_2}%</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right font-bold text-foreground">
                      {q.totalResponses.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {choiceQuestions.length > 0 && (
        <div className="pt-4 border-t border-border space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Fatores de Escolha do Hospital (Múltipla Escolha)
          </h4>

          {choiceQuestions.map((q) => {
            const counts = q.choiceCounts || {};
            const totalResp = Number(q.totalResponses) || 1;
            const sortedChoices = Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]));

            return (
              <div key={q.questionId} className="bg-muted/40 rounded-xl p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{q.title}</span>
                  <span className="text-xs text-muted-foreground font-semibold">{totalResp} respondentes</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sortedChoices.map(([optionName, optCount]) => {
                    const countVal = Number(optCount);
                    const pct = Math.round((countVal / totalResp) * 100);
                    return (
                      <div key={optionName} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-foreground">
                          <span>{optionName}</span>
                          <span className="font-bold text-foreground">{pct}% <span className="text-muted-foreground font-normal">({countVal})</span></span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
