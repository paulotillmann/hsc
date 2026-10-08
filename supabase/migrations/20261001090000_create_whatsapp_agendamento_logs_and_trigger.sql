-- Migração para registrar logs de notificações de agendamentos enviados e função de webhook
-- Criada em: 2026-10-01

-- 1. Extensão pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Tabela de logs e idempotência de envio de WhatsApp para Agendamentos
CREATE TABLE IF NOT EXISTS public.whatsapp_agendamento_notification_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  card_id TEXT,
  destinatario TEXT NOT NULL,
  paciente TEXT,
  medico TEXT,
  horario TEXT,
  data_consulta TEXT,
  status TEXT NOT NULL DEFAULT 'sucesso', -- 'enviando', 'sucesso', 'erro'
  mensagem TEXT,
  error_message TEXT,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT whatsapp_agendamento_notification_logs_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.whatsapp_agendamento_notification_logs IS 'Tabela que armazena os envios de WhatsApp quando um agendamento é movido para Enviadas no Kanban';

-- 3. Habilitar RLS
ALTER TABLE public.whatsapp_agendamento_notification_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'whatsapp_agendamento_notification_logs' AND policyname = 'Permitir leitura de logs de agendamento para autenticados'
    ) THEN
        CREATE POLICY "Permitir leitura de logs de agendamento para autenticados"
        ON public.whatsapp_agendamento_notification_logs
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;
