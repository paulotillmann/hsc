// src/services/dashboardService.ts

import { supabase } from '../lib/supabase';

export interface DashboardHolerite {
  id: string;
  mes_ano: string;
  total_liquido: number | null;
  cpf: string;
  email_enviado_em: string | null;
  created_at?: string;
  pdf_url?: string;
}

export interface DashboardInforme {
  id: string;
  ano_referencia: number;
  cpf: string;
  email_enviado_em: string | null;
  created_at?: string;
}

export interface DashboardData {
  holerites: DashboardHolerite[];
  informes: DashboardInforme[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [holeritesRes, informesRes] = await Promise.all([
    supabase.from('holerites').select('id, mes_ano, total_liquido, cpf, email_enviado_em, created_at, pdf_url'),
    supabase.from('informes').select('id, ano_referencia, cpf, email_enviado_em, created_at')
  ]);

  if (holeritesRes.error) throw new Error(`Erro ao carregar holerites: ${holeritesRes.error.message}`);
  if (informesRes.error) throw new Error(`Erro ao carregar informes: ${informesRes.error.message}`);

  return {
    holerites: (holeritesRes.data as DashboardHolerite[]) || [],
    informes: (informesRes.data as DashboardInforme[]) || [],
  };
}
