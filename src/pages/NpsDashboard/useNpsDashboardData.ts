import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  PeriodOption,
  DateRange,
  DashboardKpis,
  NpsEvolutionPoint,
  SurveyVolumePoint,
  QuestionPerformance,
  RankingItem,
  SurveyRow,
  SurveyDetail,
  NpsClassification
} from './types';

interface Question {
  id: string;
  title: string;
  type: string;
  options?: string[];
  required: boolean;
  order_num: number;
}

interface UseNpsDashboardDataProps {
  period: PeriodOption;
  customRange?: DateRange;
  npsFilter?: 'all' | 'promoter' | 'neutral' | 'detractor';
  searchTerm?: string;
}

export const useNpsDashboardData = ({
  period,
  customRange,
  npsFilter = 'all',
  searchTerm = ''
}: UseNpsDashboardDataProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<DashboardKpis>({
    npsScore: 0,
    npsPrevious: 0,
    npsDiff: 0,
    totalSurveys: 0,
    totalPrevious: 0,
    totalDiffPct: 0,
    promotersCount: 0,
    promotersPct: 0,
    neutralsCount: 0,
    neutralsPct: 0,
    detractorsCount: 0,
    detractorsPct: 0,
    surveysToday: 0
  });

  const [evolutionData, setEvolutionData] = useState<NpsEvolutionPoint[]>([]);
  const [volumeData, setVolumeData] = useState<SurveyVolumePoint[]>([]);
  const [questionPerformance, setQuestionPerformance] = useState<QuestionPerformance[]>([]);
  const [bestRankings, setBestRankings] = useState<RankingItem[]>([]);
  const [attentionRankings, setAttentionRankings] = useState<RankingItem[]>([]);
  const [recentSurveys, setRecentSurveys] = useState<SurveyRow[]>([]);
  const [selectedSurveyDetail, setSelectedSurveyDetail] = useState<SurveyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const getDateBoundaries = useCallback(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);
    let prevStartDate = new Date();
    let prevEndDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        prevStartDate.setDate(startDate.getDate() - 1);
        prevStartDate.setHours(0, 0, 0, 0);
        prevEndDate.setDate(startDate.getDate() - 1);
        prevEndDate.setHours(23, 59, 59, 999);
        break;

      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);

        prevStartDate.setDate(now.getDate() - 2);
        prevStartDate.setHours(0, 0, 0, 0);
        prevEndDate.setDate(now.getDate() - 2);
        prevEndDate.setHours(23, 59, 59, 999);
        break;

      case '7d':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);

        prevStartDate.setDate(now.getDate() - 14);
        prevStartDate.setHours(0, 0, 0, 0);
        prevEndDate.setDate(now.getDate() - 7);
        prevEndDate.setHours(23, 59, 59, 999);
        break;

      case '30d':
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);

        prevStartDate.setDate(now.getDate() - 60);
        prevStartDate.setHours(0, 0, 0, 0);
        prevEndDate.setDate(now.getDate() - 30);
        prevEndDate.setHours(23, 59, 59, 999);
        break;

      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;

      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
        prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
        break;

      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);

        prevStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
        prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;

      case 'custom':
        if (customRange?.startDate && customRange?.endDate) {
          startDate = new Date(`${customRange.startDate}T00:00:00`);
          endDate = new Date(`${customRange.endDate}T23:59:59`);

          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          prevEndDate = new Date(startDate.getTime() - 1);
          prevStartDate = new Date(prevEndDate.getTime() - diffDays * 24 * 60 * 60 * 1000);
        }
        break;
    }

    return {
      currentStart: startDate.toISOString(),
      currentEnd: endDate.toISOString(),
      prevStart: prevStartDate.toISOString(),
      prevEnd: prevEndDate.toISOString()
    };
  }, [period, customRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { currentStart, currentEnd, prevStart, prevEnd } = getDateBoundaries();

      const { data: questionsData, error: qError } = await supabase
        .from('pesquisa_perguntas')
        .select('*')
        .order('order_num', { ascending: true });

      if (qError) throw qError;
      const questionsList: Question[] = questionsData || [];

      const { data: currentRespondents, error: rCurrError } = await supabase
        .from('pesquisa_respondentes')
        .select('id, created_at, nome, duvida')
        .gte('created_at', currentStart)
        .lte('created_at', currentEnd)
        .order('created_at', { ascending: false });

      if (rCurrError) throw rCurrError;

      const { data: prevRespondents, error: rPrevError } = await supabase
        .from('pesquisa_respondentes')
        .select('id, created_at')
        .gte('created_at', prevStart)
        .lte('created_at', prevEnd);

      if (rPrevError) throw rPrevError;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: countToday } = await supabase
        .from('pesquisa_respondentes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      const respondents = currentRespondents || [];
      const prevRespondentsList = prevRespondents || [];
      const respondentIds = respondents.map((r) => r.id);
      const prevRespondentIds = prevRespondentsList.map((r) => r.id);

      let currentAnswers: any[] = [];
      if (respondentIds.length > 0) {
        const { data: ansData, error: ansError } = await supabase
          .from('pesquisa_respostas')
          .select('id, respondente_id, pergunta_id, resposta, created_at')
          .in('respondente_id', respondentIds);

        if (ansError) throw ansError;
        currentAnswers = ansData || [];
      }

      let prevAnswers: any[] = [];
      if (prevRespondentIds.length > 0) {
        const { data: pAnsData } = await supabase
          .from('pesquisa_respostas')
          .select('respondente_id, pergunta_id, resposta')
          .eq('pergunta_id', 'nps_recomendacao')
          .in('respondente_id', prevRespondentIds);

        prevAnswers = pAnsData || [];
      }

      const npsAnswers = currentAnswers.filter((a) => a.pergunta_id === 'nps_recomendacao');

      let promoters = 0;
      let neutrals = 0;
      let detractors = 0;

      const respondentNpsMap = new Map<string, { score: number; classification: NpsClassification }>();

      npsAnswers.forEach((ans) => {
        const score = parseInt(String(ans.resposta), 10);
        if (!isNaN(score)) {
          let classification: NpsClassification = 'neutral';
          if (score >= 9) {
            promoters++;
            classification = 'promoter';
          } else if (score >= 7) {
            neutrals++;
            classification = 'neutral';
          } else {
            detractors++;
            classification = 'detractor';
          }
          respondentNpsMap.set(ans.respondente_id, { score, classification });
        }
      });

      const totalNps = promoters + neutrals + detractors;
      const currentNpsScore = totalNps > 0
        ? Math.round(((promoters - detractors) / totalNps) * 100)
        : 0;

      let prevPromoters = 0;
      let prevDetractors = 0;
      let prevTotalNps = 0;

      prevAnswers.forEach((ans) => {
        const score = parseInt(String(ans.resposta), 10);
        if (!isNaN(score)) {
          prevTotalNps++;
          if (score >= 9) prevPromoters++;
          else if (score <= 6) prevDetractors++;
        }
      });

      const prevNpsScore = prevTotalNps > 0
        ? Math.round(((prevPromoters - prevDetractors) / prevTotalNps) * 100)
        : 0;

      const npsDiff = currentNpsScore - prevNpsScore;

      const totalSurveys = respondents.length;
      const totalPrevious = prevRespondentsList.length;
      const totalDiffPct = totalPrevious > 0
        ? Math.round(((totalSurveys - totalPrevious) / totalPrevious) * 100)
        : 0;

      setKpis({
        npsScore: currentNpsScore,
        npsPrevious: prevNpsScore,
        npsDiff,
        totalSurveys,
        totalPrevious,
        totalDiffPct,
        promotersCount: promoters,
        promotersPct: totalNps > 0 ? parseFloat(((promoters / totalNps) * 100).toFixed(1)) : 0,
        neutralsCount: neutrals,
        neutralsPct: totalNps > 0 ? parseFloat(((neutrals / totalNps) * 100).toFixed(1)) : 0,
        detractorsCount: detractors,
        detractorsPct: totalNps > 0 ? parseFloat(((detractors / totalNps) * 100).toFixed(1)) : 0,
        surveysToday: countToday || 0
      });

      const timeMap = new Map<string, {
        dateStr: string;
        label: string;
        promoters: number;
        neutrals: number;
        detractors: number;
        total: number;
      }>();

      respondents.forEach((r) => {
        const d = new Date(r.created_at);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!timeMap.has(dateStr)) {
          timeMap.set(dateStr, {
            dateStr,
            label: dayLabel,
            promoters: 0,
            neutrals: 0,
            detractors: 0,
            total: 0
          });
        }

        const item = timeMap.get(dateStr)!;
        item.total++;

        const npsInfo = respondentNpsMap.get(r.id);
        if (npsInfo) {
          if (npsInfo.classification === 'promoter') item.promoters++;
          else if (npsInfo.classification === 'neutral') item.neutrals++;
          else if (npsInfo.classification === 'detractor') item.detractors++;
        }
      });

      const sortedTimeKeys = Array.from(timeMap.keys()).sort();

      const evolutionPoints: NpsEvolutionPoint[] = sortedTimeKeys.map((key) => {
        const item = timeMap.get(key)!;
        const sumNps = item.promoters + item.neutrals + item.detractors;
        const npsScore = sumNps > 0
          ? Math.round(((item.promoters - item.detractors) / sumNps) * 100)
          : 0;

        return {
          date: item.dateStr,
          label: item.label,
          npsScore,
          total: item.total,
          promoters: item.promoters,
          neutrals: item.neutrals,
          detractors: item.detractors
        };
      });

      const volumePoints: SurveyVolumePoint[] = evolutionPoints.map((ep) => ({
        date: ep.date,
        label: ep.label,
        total: ep.total,
        npsScore: ep.npsScore
      }));

      setEvolutionData(evolutionPoints);
      setVolumeData(volumePoints);

      const perfList: QuestionPerformance[] = [];
      const bestRankItems: RankingItem[] = [];
      const attentionRankItems: RankingItem[] = [];

      questionsList.forEach((q) => {
        if (q.type === 'nps') return;

        const qAnswers = currentAnswers.filter((a) => a.pergunta_id === q.id);
        const totalResp = qAnswers.length;

        if (q.type === 'rating') {
          const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          let sumRating = 0;
          let positiveCount = 0;

          qAnswers.forEach((ans) => {
            const val = parseInt(String(ans.resposta), 10);
            if (val >= 1 && val <= 5) {
              ratingCounts[val as 1 | 2 | 3 | 4 | 5]++;
              sumRating += val;
              if (val >= 4) positiveCount++;
            }
          });

          const avg = totalResp > 0 ? parseFloat((sumRating / totalResp).toFixed(1)) : 0;
          const posPct = totalResp > 0 ? Math.round((positiveCount / totalResp) * 100) : 0;

          perfList.push({
            questionId: q.id,
            title: q.title,
            type: 'rating',
            averageRating: avg,
            positivePct: posPct,
            totalResponses: totalResp,
            ratingCounts
          });

          if (posPct >= 80) {
            bestRankItems.push({
              id: q.id,
              title: q.title,
              scorePct: posPct,
              subtitle: `Média ${avg} ★ (${totalResp} respostas)`,
              totalResponses: totalResp
            });
          } else {
            attentionRankItems.push({
              id: q.id,
              title: q.title,
              scorePct: posPct,
              subtitle: `Média ${avg} ★ (${totalResp} respostas)`,
              totalResponses: totalResp
            });
          }
        } else if (q.type === 'multiple_choice') {
          const choiceCounts: Record<string, number> = {};

          qAnswers.forEach((ans) => {
            let rawArr: string[] = [];
            if (Array.isArray(ans.resposta)) rawArr = ans.resposta;
            else if (typeof ans.resposta === 'string') {
              try {
                rawArr = JSON.parse(ans.resposta);
              } catch {
                rawArr = [ans.resposta];
              }
            }

            rawArr.forEach((opt) => {
              choiceCounts[opt] = (choiceCounts[opt] || 0) + 1;
            });
          });

          perfList.push({
            questionId: q.id,
            title: q.title,
            type: 'multiple_choice',
            totalResponses: totalResp,
            choiceCounts
          });

          Object.entries(choiceCounts).forEach(([optName, optCount]) => {
            const pct = totalResp > 0 ? Math.round((optCount / totalResp) * 100) : 0;
            bestRankItems.push({
              id: `${q.id}-${optName}`,
              title: `${optName}`,
              scorePct: pct,
              subtitle: `Escolha em Motivo (${optCount} citações)`,
              totalResponses: optCount
            });
          });
        }
      });

      bestRankItems.sort((a, b) => b.scorePct - a.scorePct);
      attentionRankItems.sort((a, b) => a.scorePct - b.scorePct);

      setQuestionPerformance(perfList);
      setBestRankings(bestRankItems.slice(0, 5));
      setAttentionRankings(attentionRankItems.slice(0, 5));

      let tableRows: SurveyRow[] = respondents.map((r) => {
        const rAnswers = currentAnswers.filter((a) => a.respondente_id === r.id);
        const npsAns = rAnswers.find((a) => a.pergunta_id === 'nps_recomendacao');
        const eqAns = rAnswers.find((a) => a.pergunta_id === 'avaliacao_equipe');
        const gerAns = rAnswers.find((a) => a.pergunta_id === 'avaliacao_geral');
        const posText = rAnswers.find((a) => a.pergunta_id === 'feedback_positivo')?.resposta;
        const negText = rAnswers.find((a) => a.pergunta_id === 'feedback_negativo')?.resposta;

        const score = npsAns ? parseInt(String(npsAns.resposta), 10) : 0;
        let classification: NpsClassification = 'neutral';
        if (score >= 9) classification = 'promoter';
        else if (score <= 6) classification = 'detractor';

        const hasTextFeedback = !!(
          (typeof posText === 'string' && posText.trim().length > 0) ||
          (typeof negText === 'string' && negText.trim().length > 0) ||
          (r.duvida && r.duvida.trim().length > 0)
        );

        return {
          id: r.id,
          createdAt: r.created_at,
          nome: r.nome,
          npsScore: score,
          npsClassification: classification,
          equipeRating: eqAns ? parseInt(String(eqAns.resposta), 10) : undefined,
          geralRating: gerAns ? parseInt(String(gerAns.resposta), 10) : undefined,
          hasTextFeedback,
          respostasCount: rAnswers.length
        };
      });

      // Aplica Filtro NPS
      if (npsFilter !== 'all') {
        tableRows = tableRows.filter((row) => row.npsClassification === npsFilter);
      }

      // Aplica Busca de Texto (Nome ou Comentários)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        tableRows = tableRows.filter((row) => {
          const nameMatch = row.nome ? row.nome.toLowerCase().includes(term) : false;
          const rAnswers = currentAnswers.filter((a) => a.respondente_id === row.id);
          const answerMatch = rAnswers.some((a) => {
            const strVal = typeof a.resposta === 'string' ? a.resposta : JSON.stringify(a.resposta);
            return strVal.toLowerCase().includes(term);
          });
          return nameMatch || answerMatch;
        });
      }

      setRecentSurveys(tableRows);

    } catch (err: any) {
      console.error('Erro ao carregar dados do Dashboard NPS:', err);
      setError(err.message || 'Erro inesperado ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [getDateBoundaries, npsFilter, searchTerm]);

  const fetchSurveyDetail = useCallback(async (surveyId: string) => {
    setLoadingDetail(true);
    try {
      const { data: respondent, error: rErr } = await supabase
        .from('pesquisa_respondentes')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (rErr) throw rErr;

      const { data: questions } = await supabase
        .from('pesquisa_perguntas')
        .select('*')
        .order('order_num', { ascending: true });

      const { data: answers, error: aErr } = await supabase
        .from('pesquisa_respostas')
        .select('*')
        .eq('respondente_id', surveyId);

      if (aErr) throw aErr;

      const questionsList = questions || [];
      const answersList = answers || [];

      const npsAns = answersList.find((a) => a.pergunta_id === 'nps_recomendacao');
      const score = npsAns ? parseInt(String(npsAns.resposta), 10) : undefined;
      let classification: NpsClassification | undefined;

      if (score !== undefined) {
        if (score >= 9) classification = 'promoter';
        else if (score >= 7) classification = 'neutral';
        else classification = 'detractor';
      }

      const formattedAnswers = questionsList.map((q) => {
        const ans = answersList.find((a) => a.pergunta_id === q.id);
        return {
          perguntaId: q.id,
          perguntaTitle: q.title,
          type: q.type,
          resposta: ans ? ans.resposta : null
        };
      });

      const detail: SurveyDetail = {
        id: respondent.id,
        createdAt: respondent.created_at,
        nome: respondent.nome,
        endereco: respondent.endereco,
        telefone: respondent.telefone,
        duvida: respondent.duvida,
        npsScore: score,
        npsClassification: classification,
        respostas: formattedAnswers
      };

      setSelectedSurveyDetail(detail);
    } catch (err) {
      console.error('Erro ao buscar detalhes da pesquisa:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const closeSurveyDetail = useCallback(() => {
    setSelectedSurveyDetail(null);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
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
  };
};
