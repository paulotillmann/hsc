export type PeriodOption = 
  | 'today' 
  | 'yesterday' 
  | '7d' 
  | '30d' 
  | 'this_month' 
  | 'last_month' 
  | 'this_year' 
  | 'custom';

export interface DateRange {
  startDate: string; // ISO String (YYYY-MM-DD)
  endDate: string;   // ISO String (YYYY-MM-DD)
}

export type NpsClassification = 'promoter' | 'neutral' | 'detractor';

export interface DashboardKpis {
  npsScore: number;
  npsPrevious: number;
  npsDiff: number;
  totalSurveys: number;
  totalPrevious: number;
  totalDiffPct: number;
  promotersCount: number;
  promotersPct: number;
  neutralsCount: number;
  neutralsPct: number;
  detractorsCount: number;
  detractorsPct: number;
  surveysToday: number;
}

export interface NpsEvolutionPoint {
  date: string;       // Data YYYY-MM-DD
  label: string;      // Rótulo "12/08"
  npsScore: number;   // Score NPS (-100 a +100)
  total: number;      // Total de pesquisas
  promoters: number;
  neutrals: number;
  detractors: number;
}

export interface SurveyVolumePoint {
  date: string;
  label: string;
  total: number;
  npsScore: number;
}

export interface QuestionPerformance {
  questionId: string;
  title: string;
  type: 'rating' | 'multiple_choice' | 'nps' | 'text';
  averageRating?: number;
  positivePct?: number;
  totalResponses: number;
  ratingCounts?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  choiceCounts?: Record<string, number>;
}

export interface RankingItem {
  id: string;
  title: string;
  scorePct: number;
  subtitle: string;
  totalResponses: number;
}

export interface SurveyRow {
  id: string;
  createdAt: string;
  nome?: string;
  npsScore: number;
  npsClassification: NpsClassification;
  equipeRating?: number;
  geralRating?: number;
  hasTextFeedback: boolean;
  respostasCount: number;
}

export interface SurveyAnswerDetail {
  perguntaId: string;
  perguntaTitle: string;
  type: string;
  resposta: any;
}

export interface SurveyDetail {
  id: string;
  createdAt: string;
  nome?: string;
  endereco?: string;
  telefone?: string;
  duvida?: string;
  npsScore?: number;
  npsClassification?: NpsClassification;
  respostas: SurveyAnswerDetail[];
}
