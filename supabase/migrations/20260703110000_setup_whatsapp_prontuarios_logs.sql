-- Migração para criação da tabela de controle de envio de notificações de WhatsApp (Idempotência)
-- Criada em: 2026-07-03

-- 1. Criação da tabela whatsapp_notification_logs
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  solicitacao_id UUID NOT NULL,
  status TEXT NOT NULL, -- 'enviando', 'sucesso', 'erro'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT whatsapp_notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_notification_logs_solicitacao_id_key UNIQUE (solicitacao_id),
  CONSTRAINT fk_solicitacao FOREIGN KEY (solicitacao_id) REFERENCES public.solicitacoes_prontuario(id) ON DELETE CASCADE
);

-- 2. Comentários para documentação
COMMENT ON TABLE public.whatsapp_notification_logs IS 'Tabela que armazena os envios de mensagens automáticas de WhatsApp para novas solicitações (idempotência)';

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;

-- Nota: Como a Edge Function roda com a role service_role, ela possui acesso total por padrão e ignora o RLS.
-- Nenhuma política pública ou autenticada é criada para garantir máxima segurança.
