-- Migração para adicionar controle de status de envio de e-mails no módulo de Plantão Médico
-- Criada em: 2026-08-19

-- 1. Adicionar colunas na tabela plantao_medico_producoes
ALTER TABLE public.plantao_medico_producoes
  ADD COLUMN IF NOT EXISTS email_enviado boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS email_enviado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS email_enviado_para text[] DEFAULT '{}'::text[] NOT NULL;

-- 2. Criar tabela de auditoria de logs de disparo de e-mails
CREATE TABLE IF NOT EXISTS public.plantao_medico_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico text NOT NULL,
  especialidade text DEFAULT '',
  tipo_plantao text DEFAULT '',
  periodo_de date NOT NULL,
  periodo_ate date NOT NULL,
  destinatarios text[] DEFAULT '{}'::text[] NOT NULL,
  status text NOT NULL, -- 'sucesso' ou 'erro'
  mensagem_erro text,
  enviado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_plantao_medico_email_logs_periodo 
  ON public.plantao_medico_email_logs (periodo_de, periodo_ate);

CREATE INDEX IF NOT EXISTS idx_plantao_medico_email_logs_medico 
  ON public.plantao_medico_email_logs (medico);

-- Ativar RLS
ALTER TABLE public.plantao_medico_email_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
DROP POLICY IF EXISTS "Permitir leitura de logs de e-mail de plantão para autenticados" ON public.plantao_medico_email_logs;
CREATE POLICY "Permitir leitura de logs de e-mail de plantão para autenticados" ON public.plantao_medico_email_logs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir inserção de logs de e-mail de plantão para autenticados" ON public.plantao_medico_email_logs;
CREATE POLICY "Permitir inserção de logs de e-mail de plantão para autenticados" ON public.plantao_medico_email_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);
