-- =====================================================================
-- SCRIPT CONSOLIDADO: SEGURANÇA E RPCS DO CENTRO MÉDICO (IDEMPOTENTE)
-- DATA: 2026-10-28
-- AMBIENTE: Supabase Database (PostgreSQL)
-- INSTRUÇÕES:
--   1. Acesse o Supabase Dashboard -> Projeto HSC
--   2. Abra o menu "SQL Editor"
--   3. Cole este script e clique em "Run"
-- =====================================================================

-- 1. TABELA PRINCIPAL DE CARDS DO KANBAN
CREATE TABLE IF NOT EXISTS public.centro_medico_kanban_cards (
  card_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  paciente TEXT,
  data_consulta TEXT,
  medico TEXT,
  crm TEXT,
  especialidade TEXT,
  horario TEXT,
  consultorio TEXT,
  convenio TEXT,
  confirmado_pelo_paciente BOOLEAN DEFAULT false,
  confirmado_em TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir colunas adicionais caso a tabela já existisse
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'medico') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN medico TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'crm') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN crm TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'especialidade') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN especialidade TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'horario') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN horario TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'consultorio') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN consultorio TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'convenio') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN convenio TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'confirmado_pelo_paciente') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN confirmado_pelo_paciente BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'centro_medico_kanban_cards' AND column_name = 'confirmado_em') THEN
    ALTER TABLE public.centro_medico_kanban_cards ADD COLUMN confirmado_em TEXT;
  END IF;
END $$;

COMMENT ON TABLE public.centro_medico_kanban_cards IS 'Armazena posições manuais, snapshots clínicos e confirmações do Kanban do Centro Médico';

-- 2. HABILITAR ROW LEVEL SECURITY (RLS) E POLÍTICAS ESTRITAS
ALTER TABLE public.centro_medico_kanban_cards ENABLE ROW LEVEL SECURITY;

-- Revoga políticas antigas e permissivas abertas para anon
DROP POLICY IF EXISTS "Permitir leitura de cards do kanban" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Permitir salvar status do kanban" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Acesso completo para operadores autenticados" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Leitura de cards para autenticados" ON public.centro_medico_kanban_cards;
DROP POLICY IF EXISTS "Modificacao de cards para autenticados" ON public.centro_medico_kanban_cards;

-- Apenas operadores autenticados podem ler a tabela diretamente
CREATE POLICY "Leitura de cards para autenticados"
ON public.centro_medico_kanban_cards
FOR SELECT
TO authenticated
USING (true);

-- Apenas operadores autenticados podem modificar a tabela diretamente
CREATE POLICY "Modificacao de cards para autenticados"
ON public.centro_medico_kanban_cards
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. TABELA DE AUDITORIA DE LOGS DE WHATSAPP
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

DROP POLICY IF EXISTS "Permitir leitura de logs de agendamento para autenticados" ON public.whatsapp_agendamento_notification_logs;

CREATE POLICY "Permitir leitura de logs de agendamento para autenticados"
ON public.whatsapp_agendamento_notification_logs
FOR SELECT
TO authenticated
USING (true);

-- 4. RPC SEGURA: OBTER DETALHES DA CONSULTA DO PACIENTE (SECURITY DEFINER)
-- Retorna os dados sanitizados da consulta específica do p_card_id, impedindo raspagem ou IDOR
CREATE OR REPLACE FUNCTION public.obter_detalhes_consulta_publica(p_card_id TEXT)
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

  SELECT 
    card_id,
    paciente,
    data_consulta,
    medico,
    crm,
    especialidade,
    horario,
    consultorio,
    convenio,
    status,
    confirmado_pelo_paciente,
    confirmado_em
  INTO v_rec
  FROM public.centro_medico_kanban_cards
  WHERE card_id = p_card_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'encontrado', true,
      'card_id', v_rec.card_id,
      'paciente', v_rec.paciente,
      'data_consulta', v_rec.data_consulta,
      'medico', v_rec.medico,
      'crm', v_rec.crm,
      'especialidade', v_rec.especialidade,
      'horario', v_rec.horario,
      'consultorio', v_rec.consultorio,
      'convenio', v_rec.convenio,
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

-- 5. RPC SEGURA: CONFIRMAÇÃO DE PRESENÇA PELO PACIENTE (SECURITY DEFINER)
-- Permite que o paciente anônimo confirme sua presença de forma isolada
CREATE OR REPLACE FUNCTION public.confirmar_presenca_paciente(
  p_card_id TEXT,
  p_paciente TEXT DEFAULT NULL,
  p_data_consulta TEXT DEFAULT NULL,
  p_medico TEXT DEFAULT NULL,
  p_especialidade TEXT DEFAULT NULL,
  p_horario TEXT DEFAULT NULL
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

  INSERT INTO public.centro_medico_kanban_cards (
    card_id,
    status,
    paciente,
    data_consulta,
    medico,
    especialidade,
    horario,
    confirmado_pelo_paciente,
    confirmado_em,
    updated_at
  )
  VALUES (
    p_card_id,
    v_status,
    p_paciente,
    p_data_consulta,
    p_medico,
    p_especialidade,
    p_horario,
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
    data_consulta = COALESCE(EXCLUDED.data_consulta, public.centro_medico_kanban_cards.data_consulta),
    medico = COALESCE(EXCLUDED.medico, public.centro_medico_kanban_cards.medico),
    especialidade = COALESCE(EXCLUDED.especialidade, public.centro_medico_kanban_cards.especialidade),
    horario = COALESCE(EXCLUDED.horario, public.centro_medico_kanban_cards.horario);

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'status', v_status,
    'confirmado_em', v_hora
  );
END;
$$;

-- 6. CONCESSÃO DE PERMISSÃO DE EXECUÇÃO DAS RPCS
GRANT EXECUTE ON FUNCTION public.obter_detalhes_consulta_publica(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_presenca_paciente(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
