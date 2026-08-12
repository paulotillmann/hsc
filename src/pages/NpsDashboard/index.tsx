import React, { useState } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { ExecutiveSummary } from './ExecutiveSummary';
import { MainChartsGrid } from './MainChartsGrid';
import { SecondaryChartsGrid } from './SecondaryChartsGrid';
import { QuestionPerformanceTable } from './QuestionPerformanceTable';
import { RankingsGrid } from './RankingsGrid';
import { RecentSurveysTable } from './RecentSurveysTable';
import { SurveyDetailsDrawer } from './SurveyDetailsDrawer';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useNpsDashboardData } from './useNpsDashboardData';
import { PeriodOption, DateRange } from './types';

export default function NpsDashboard() {
  const [period, setPeriod] = useState<PeriodOption>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [npsFilter, setNpsFilter] = useState<'all' | 'promoter' | 'neutral' | 'detractor'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const {
    loading,
    error,
    kpis,
    evolutionData,
    volumeData,
    questionPerformance,
    bestRankings,
    attentionRankings,
    recentSurveys,
    selectedSurveyDetail,
    loadingDetail,
    fetchData,
    fetchSurveyDetail,
    closeSurveyDetail
  } = useNpsDashboardData({
    period,
    customRange,
    npsFilter,
    searchTerm
  });

  return (
    <div className="w-full bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground pb-12">
      <DashboardHeader
        period={period}
        onPeriodChange={setPeriod}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        npsFilter={npsFilter}
        onNpsFilterChange={setNpsFilter}
        onRefresh={fetchData}
        loading={loading}
      />

      <main className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 px-5 py-4 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-xs">
            <span>⚠️ Erro ao carregar dados do dashboard: {error}</span>
            <button
              onClick={fetchData}
              className="text-xs bg-rose-700 text-white px-3 py-1.5 rounded-xl hover:bg-rose-800 cursor-pointer font-bold"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <ExecutiveSummary kpis={kpis} />
            <MainChartsGrid evolutionData={evolutionData} kpis={kpis} />
            <SecondaryChartsGrid volumeData={volumeData} />
            <QuestionPerformanceTable performance={questionPerformance} />
            <RankingsGrid bestRankings={bestRankings} attentionRankings={attentionRankings} />
            <RecentSurveysTable
              surveys={recentSurveys}
              onSelectSurvey={fetchSurveyDetail}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </>
        )}
      </main>

      <SurveyDetailsDrawer
        detail={selectedSurveyDetail}
        loading={loadingDetail}
        onClose={closeSurveyDetail}
      />
    </div>
  );
}
