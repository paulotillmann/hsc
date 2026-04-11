// src/lib/supabase.ts
// Cliente Supabase singleton - utilize sempre este import

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          cpf: string | null;
          telefone: string | null;
          email: string | null;
          role: 'admin' | 'colaborador';
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          cpf?: string | null;
          telefone?: string | null;
          email?: string | null;
          role?: 'admin' | 'colaborador';
          avatar_url?: string | null;
        };
        Update: {
          full_name?: string | null;
          cpf?: string | null;
          telefone?: string | null;
          email?: string | null;
          role?: 'admin' | 'colaborador';
          avatar_url?: string | null;
        };
      };
      informes: {
        Row: {
          id: string;
          nome_completo: string;
          email: string | null;
          cpf: string;
          paginas: number[];
          pdf_url: string;
          pdf_filename: string;
          ano_referencia: number;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          nome_completo: string;
          email?: string | null;
          cpf: string;
          paginas: number[];
          pdf_url: string;
          pdf_filename: string;
          ano_referencia?: number;
          uploaded_by?: string | null;
        };
        Update: {
          nome_completo?: string;
          email?: string | null;
          cpf?: string;
          paginas?: number[];
          pdf_url?: string;
          pdf_filename?: string;
          ano_referencia?: number;
        };
      };
    };
  };
};
