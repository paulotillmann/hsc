-- =====================================================================
-- MIGRATION: SEGURANÇA DO MÓDULO CENTRO MÉDICO (RLS & RPCs SEGURAS)
-- DATA: 2026-10-27
-- DESCRITIVO:
--   1. Cria e atualiza a tabela public.centro_medico_kanban_cards com todas
--      as colunas necessárias (incluindo confirmado_pelo_paciente).
--   2. Corrige as políticas de Row Level Security (RLS), revogando acessos
--      irrestritos (FOR ALL) para usuários anônimos (anon).
--   3. Restringe visualização e edição direta da tabela a usuários autenticados.
--   4. Cria RPCs seguras (SECURITY DEFINER) para a tela pública do paciente
--      confirmar presença e consultar status sem expor dados de terceiros.
--   5. Garante a tabela de logs de auditoria whatsapp_agendamento_notification_logs.
-- =====================================================================

-- 1. Criação/Atualização da Tabela de Cards do Kanban
CREATE TABLE IF NOT EXISTS public.centro_medico_kanban_cards (
  card_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  paciente TEXT,
  data_consulta TEXT,
  confirmado_pelo_paciente BOOLEAN DEFAULT false,
  confirmado_em TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas caso a tabela já existisse sem elas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'centro_medico_kanban_cards' 
      AND column_name = 'confirmado_pelo_paciente'
  ) THEN
    ALTER TABLE public.centro_medico_kanban_cards 
    ADD COLUMN confirmado_pelo_paciente BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'centro_medico_kanban_cards' 
      AND column_name = 'confirmado_em'
  ) THEN
    ALTER TABLE public.centro_medico_kanban_cards 
    ADD COLUMN confirmado_em TEXT;
  END IF;
END $$;

COMMENT ON TABLE public.centro_medico_kanban_cards IS 'Armazena posições manuais e confirmações de presença do Kanban do Centro Médico';

-- 2. Habilitar RLS estrito
ALTER TABLE public.centro_medico_kanban_cards ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas/permissivas caso existam
DROP POLICY IF EXISTS "Permitir leitura de cards do kanban" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Permitir salvar status do kanban" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Acesso completo para operadores autenticados" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Leitura de cards para autenticados" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Modificacao de cards para autenticados" ON public.centro_medico_kanban_cards;

-- 3. Políticas para Usuários Autenticados (Operadores e Médicos)
CREATE POLICY "Leitura de cards para autenticados"
ON public.centro_medico_kanban_cards
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Modificacao de cards para autenticados"
ON public.centro_medico_kanban_cards
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. RPC Segura: Confirmação de Presença pelo Paciente (SECURITY DEFINER)
-- Permite que o paciente anônimo confirme sua presença com apenas o card_id, sem poder ler ou alterar outros cards
CREATE OR REPLACE FUNCTION public.confirmar_presenca_paciente(
  p_card_id TEXT,
  p_paciente TEXT DEFAULT NULL,
  p_data_consulta TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hora TEXT;
  v_status TEXT := 'Confirmadas';
BEGIN
  IF p_card_id IS NULL OR trim(p_card_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'card_id_obrigatorio'
    );
  END IF;

  -- Formata hora no fuso horário de Brasília
  v_hora := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

  -- Upsert seguro isolado no card solicitado
  INSERT INTO public.centro_medico_kanban_cards (
    card_id,
    status,
    paciente,
    data_consulta,
    confirmado_pelo_paciente,
    confirmado_em,
    updated_at
  )
  VALUES (
    p_card_id,
    v_status,
    p_paciente,
    p_data_consulta,
    true,
    v_hora,
    now()
  )
  ON CONFLICT (card_id) DO UPDATE SET
    status = v_status,
    confirmado_pelo_paciente = true,
    confirmado_em = v_hora,
    updated_at = now(),
    paciente = COALESCE(EXCLUDED.paciente, public.centro_medico_kanban_cards.paciente),
    data_consulta = COALESCE(EXCLUDED.data_consulta, public.centro_medico_kanban_cards.data_consulta);

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'status', v_status,
    'confirmado_em', v_hora
  );
END;
$$;

-- 5. RPC Segura: Consulta do Status de Presença do Paciente (SECURITY DEFINER)
-- Permite que a tela pública consulte se aquele card_id específico já foi confirmado, sem listar a tabela inteira
CREATE OR REPLACE FUNCTION public.obter_status_consulta_paciente(p_card_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  IF p_card_id IS NULL OR trim(p_card_id) = '' THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  SELECT status, confirmado_pelo_paciente, confirmado_em, updated_at
  INTO v_rec
  FROM public.centro_medico_kanban_cards
  WHERE card_id = p_card_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'encontrado', true,
      'card_id', p_card_id,
      'status', v_rec.status,
      'confirmado_pelo_paciente', COALESCE(v_rec.confirmado_pelo_paciente, false),
      'confirmado_em', v_rec.confirmado_em
    );
  ELSE
    RETURN jsonb_build_object(
      'encontrado', false,
      'card_id', p_card_id,
      'confirmado_pelo_paciente', false
    );
  END IF;
END;
$$;

-- Conceder permissão de execução das RPCs para anon e authenticated
GRANT EXECUTE ON FUNCTION public.confirmar_presenca_paciente(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_status_consulta_paciente(TEXT) TO anon, authenticated;

-- 6. Garantir Tabela de Logs de Auditoria para WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_agendamento_notification_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  card_id TEXT,
  destinatario TEXT NOT NULL,
  paciente TEXT,
  medico TEXT,
  horario TEXT,
  data_consulta TEXT,
  status TEXT NOT NULL DEFAULT 'sucesso',
  mensagem TEXT,
  error_message TEXT,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT whatsapp_agendamento_notification_logs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.whatsapp_agendamento_notification_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'whatsapp_agendamento_notification_logs' 
      AND policyname = 'Permitir leitura de logs de agendamento para autenticados'
  ) THEN
    CREATE POLICY "Permitir leitura de logs de agendamento para autenticados"
    ON public.whatsapp_agendamento_notification_logs
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
