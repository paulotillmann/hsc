-- Migração: Adiciona campos de rastreamento de envio de e-mail ao Financeiro na tabela repasse_competencias
-- Criada em: 2026-09-29
-- Autor: HSC Sistemas

ALTER TABLE public.repasse_competencias 
  ADD COLUMN IF NOT EXISTS email_enviado boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS email_enviado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS email_enviado_para text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_repasse_competencias_email_enviado 
  ON public.repasse_competencias (email_enviado);
