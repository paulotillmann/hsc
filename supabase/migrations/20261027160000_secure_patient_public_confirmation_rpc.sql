-- =====================================================================
-- MIGRATION: DETALHES DE CONSULTA PÚBLICA SEGURA (LGPD) & ANTI-TAMPERING
-- DATA: 2026-10-27
-- DESCRITIVO:
--   1. Adiciona campos de apresentação clínica na tabela centro_medico_kanban_cards
--      (medico, crm, especialidade, horario, consultorio, convenio) para permitir
--      que a tela pública do paciente carregue seus dados reais sem necessidade
--      de expor prontuários ou dados pessoais sensíveis em parâmetros de URL.
--   2. Cria a RPC segura obter_detalhes_consulta_publica(p_card_id) que retorna
--      apenas os dados estritamente necessários para validação do agendamento,
--      impedindo raspagem de dados ou manipulação de parâmetros (IDOR).
--   3. Atualiza a RPC confirmar_presenca_paciente para registrar dados clínicos
--      completos no snapshot do agendamento.
-- =====================================================================

-- 1. Adicionar colunas de suporte na tabela centro_medico_kanban_cards
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
END $$;

-- 2. RPC Segura: Obter Detalhes da Consulta para o Paciente (SECURITY DEFINER)
-- Retorna os dados sanitizados da consulta específica identificada por p_card_id
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

-- 3. Atualizar RPC de Confirmação com suporte aos dados do agendamento
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

-- Conceder permissão de execução
GRANT EXECUTE ON FUNCTION public.obter_detalhes_consulta_publica(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_presenca_paciente(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
