-- =====================================================================
-- MIGRATION: MÓDULO TRIAGEM DE CURRÍCULOS E FEEDBACK (RECURSOS HUMANOS)
-- DATA: 09/11/2026
-- DESCRITIVO:
--   1. Registra o módulo 'recrutamento-selecao' na tabela public.modules
--   2. Concede acesso inicial apenas aos perfis Admin e RH
--   3. Cria a tabela public.rh_candidatos_triagem (currículos capturados via e-mail/n8n)
--   4. Cria a tabela public.rh_templates_feedback (pré-textos de reprovação/feedback)
--   5. Configura RLS (Row Level Security) e políticas de segurança
--   6. Cria o bucket 'curriculos' no Supabase Storage
-- =====================================================================

-- 1. Registrar o módulo na tabela public.modules
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
VALUES (
  'Triagem de Currículos',
  'recrutamento-selecao',
  'UserCheck',
  'Módulo de Recursos Humanos para triagem de currículos recebidos por e-mail e disparo automatizado de feedback de seleção',
  true,
  35,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- 2. Vincular permissão inicial apenas para Administradores e perfil de RH (se existir)
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'recrutamento-selecao'
  AND (
    r.slug IN ('admin', 'rh', 'recursos_humanos', 'recursos-humanos')
    OR r.name ILIKE '%Administrador%'
    OR r.name ILIKE '%Recursos Humanos%'
    OR r.name ILIKE '%RH%'
  )
ON CONFLICT (role_id, module_id) DO NOTHING;

-- 3. Criar tabela de candidatos / currículos recebidos
CREATE TABLE IF NOT EXISTS public.rh_candidatos_triagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_candidato TEXT NOT NULL,
  email_candidato TEXT NOT NULL,
  telefone TEXT,
  vaga_identificada TEXT DEFAULT 'Geral / Banco de Talentos',
  assunto_email TEXT,
  palavras_chave_detectadas TEXT[],
  resumo_perfil TEXT,
  curriculo_url TEXT,
  curriculo_nome TEXT,
  email_message_id TEXT UNIQUE,
  data_recebimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'aguardando_triagem' CHECK (
    status IN ('aguardando_triagem', 'em_analise', 'entrevista', 'aprovado', 'banco_talentos', 'reprovado')
  ),
  feedback_enviado BOOLEAN NOT NULL DEFAULT false,
  feedback_enviado_em TIMESTAMPTZ,
  feedback_enviado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback_enviado_por_nome TEXT,
  feedback_assunto TEXT,
  feedback_mensagem TEXT,
  observacoes TEXT,
  origem TEXT NOT NULL DEFAULT 'email_n8n' CHECK (origem IN ('email_n8n', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida e performance
CREATE INDEX IF NOT EXISTS idx_rh_candidatos_status ON public.rh_candidatos_triagem(status);
CREATE INDEX IF NOT EXISTS idx_rh_candidatos_email ON public.rh_candidatos_triagem(email_candidato);
CREATE INDEX IF NOT EXISTS idx_rh_candidatos_data_rec ON public.rh_candidatos_triagem(data_recebimento DESC);
CREATE INDEX IF NOT EXISTS idx_rh_candidatos_feedback ON public.rh_candidatos_triagem(feedback_enviado);

-- 4. Criar tabela de modelos (pré-textos) de e-mail para reprovação/feedback
CREATE TABLE IF NOT EXISTS public.rh_templates_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo_texto TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir modelos padrão iniciais caso a tabela esteja vazia
INSERT INTO public.rh_templates_feedback (titulo, assunto, corpo_texto, is_default)
SELECT
  'Reprovação na Triagem / Banco de Talentos',
  'Retorno sobre Processo Seletivo - {{vaga}} | Hospital Santa Casa de Araguari',
  E'Olá, {{nome}}!\n\nAgradecemos imensamente o seu interesse em fazer parte da equipe do Hospital Santa Casa de Misericórdia de Araguari e o tempo dedicado ao envio do seu currículo para a oportunidade de {{vaga}}.\n\nApós uma análise cuidadosa do seu perfil, informamos que, neste momento, optamos por seguir o processo seletivo com outros candidatos cujas experiências estão mais alinhadas aos requisitos específicos atuais da vaga.\n\nSeu currículo permanecerá ativo em nosso Banco de Talentos para futuras oportunidades compatíveis com a sua trajetória profissional.\n\nDesejamos muito sucesso em sua caminhada!\n\nAtenciosamente,\nSetor de Recursos Humanos\nHospital Santa Casa de Misericórdia de Araguari',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.rh_templates_feedback);

INSERT INTO public.rh_templates_feedback (titulo, assunto, corpo_texto, is_default)
SELECT
  'Reprovação Pós-Entrevista',
  'Feedback do Processo Seletivo - {{vaga}} | Hospital Santa Casa de Araguari',
  E'Olá, {{nome}}!\n\nFoi um prazer conhecer você e sua trajetória profissional durante a etapa de entrevista para a vaga de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari.\n\nGostaríamos de informar que concluímos esta etapa do processo seletivo e, embora tenhamos ficado muito positivamente impressionados com suas qualificações, neste momento seguiremos com outro candidato para a posição.\n\nAgradecemos sua disponibilidade e participação. Manteremos seu contato em nosso Banco de Talentos para novas oportunidades futuras.\n\nUm cordial abraço,\nSetor de Recursos Humanos\nHospital Santa Casa de Misericórdia de Araguari',
  false
WHERE (SELECT count(*) FROM public.rh_templates_feedback) = 1;

INSERT INTO public.rh_templates_feedback (titulo, assunto, corpo_texto, is_default)
SELECT
  'Vaga Suspensa / Encerrada',
  'Comunicado sobre a Vaga {{vaga}} | Hospital Santa Casa de Araguari',
  E'Olá, {{nome}}!\n\nAgradecemos a sua candidatura para a vaga de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari.\n\nInformamos que, por questões de reestruturação interna, o processo seletivo para esta vaga foi suspenso temporariamente.\n\nSeu currículo já está salvo em nosso Banco de Talentos e, assim que uma nova oportunidade compatível surgir, entraremos em contato.\n\nAtenciosamente,\nSetor de Recursos Humanos\nHospital Santa Casa de Misericórdia de Araguari',
  false
WHERE (SELECT count(*) FROM public.rh_templates_feedback) = 2;

-- 5. Habilitar RLS e criar função auxiliar de verificação de permissão ao módulo
ALTER TABLE public.rh_candidatos_triagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_templates_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_recrutamento()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.id = p.role_id
    LEFT JOIN public.role_module_permissions rmp ON rmp.role_id = p.role_id
    LEFT JOIN public.modules m ON m.id = rmp.module_id
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_blocked, false) = false
      AND (
        p.role IN ('admin', 'Administrador')
        OR r.slug = 'admin'
        OR r.can_config = true
        OR (m.slug = 'recrutamento-selecao' AND m.is_active = true)
      )
  );
$$;

-- Políticas para rh_candidatos_triagem
DROP POLICY IF EXISTS "Acesso permitido a usuarios com modulo recrutamento-selecao" ON public.rh_candidatos_triagem;
CREATE POLICY "Acesso permitido a usuarios com modulo recrutamento-selecao"
  ON public.rh_candidatos_triagem
  FOR ALL
  TO authenticated
  USING (public.user_can_access_recrutamento())
  WITH CHECK (public.user_can_access_recrutamento());

-- Políticas para rh_templates_feedback
DROP POLICY IF EXISTS "Acesso templates para usuarios com modulo recrutamento-selecao" ON public.rh_templates_feedback;
CREATE POLICY "Acesso templates para usuarios com modulo recrutamento-selecao"
  ON public.rh_templates_feedback
  FOR ALL
  TO authenticated
  USING (public.user_can_access_recrutamento())
  WITH CHECK (public.user_can_access_recrutamento());

-- 6. Criar bucket de Storage 'curriculos' caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('curriculos', 'curriculos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura publica de curriculos" ON storage.objects;
CREATE POLICY "Leitura publica de curriculos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curriculos');

DROP POLICY IF EXISTS "Upload de curriculos por usuarios autenticados" ON storage.objects;
CREATE POLICY "Upload de curriculos por usuarios autenticados"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'curriculos');

