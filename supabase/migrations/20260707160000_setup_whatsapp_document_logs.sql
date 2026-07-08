-- Migração para criação da tabela de controle de envio de notificações de WhatsApp para documentos anexados (Idempotência)
-- Criada em: 2026-07-07

CREATE TABLE IF NOT EXISTS public.whatsapp_document_notification_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  solicitacao_id UUID NOT NULL,
  status TEXT NOT NULL, -- 'enviando', 'sucesso', 'erro'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT whatsapp_document_notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_document_notification_logs_solicitacao_id_key UNIQUE (solicitacao_id),
  CONSTRAINT fk_solicitacao FOREIGN KEY (solicitacao_id) REFERENCES public.solicitacoes_prontuario(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.whatsapp_document_notification_logs IS 'Tabela que armazena os envios de mensagens automáticas de WhatsApp para documentos anexados a solicitações (idempotência)';

ALTER TABLE public.whatsapp_document_notification_logs ENABLE ROW LEVEL SECURITY;
