-- Migração para cadastrar contatos/emails dos médicos no módulo de Plantão Médico
-- Criada em: 2026-08-17

CREATE TABLE IF NOT EXISTS public.plantao_medico_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_medico text NOT NULL UNIQUE,
  emails text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar Row Level Security
ALTER TABLE public.plantao_medico_contatos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Leitura permitida para usuários autenticados
DROP POLICY IF EXISTS "Permitir leitura de contatos médicos para autenticados" ON public.plantao_medico_contatos;
CREATE POLICY "Permitir leitura de contatos médicos para autenticados" ON public.plantao_medico_contatos
  FOR SELECT TO authenticated
  USING (true);

-- 2. Inserção / Edição / Deleção permitida para autenticados
DROP POLICY IF EXISTS "Permitir gerenciamento de contatos médicos para autenticados" ON public.plantao_medico_contatos;
CREATE POLICY "Permitir gerenciamento de contatos médicos para autenticados" ON public.plantao_medico_contatos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Gatilho para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_plantao_medico_contatos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_plantao_medico_contatos_updated_at ON public.plantao_medico_contatos;
CREATE TRIGGER tr_plantao_medico_contatos_updated_at
  BEFORE UPDATE ON public.plantao_medico_contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_plantao_medico_contatos_updated_at();
