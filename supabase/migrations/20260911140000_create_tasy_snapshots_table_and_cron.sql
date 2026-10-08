-- Migration: Criação da tabela de snapshots diários do Tasy, storage bucket e cron job das 23:50
-- Data: 2026-09-11

-- 1. Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criação da tabela de snapshots diários
CREATE TABLE IF NOT EXISTS public.tasy_snapshots_diarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_referencia DATE UNIQUE NOT NULL,
    total_conectados INTEGER NOT NULL DEFAULT 0,
    pico_quantidade INTEGER NOT NULL DEFAULT 0,
    pico_horario TEXT,
    percentual_ocupacao INTEGER NOT NULL DEFAULT 0,
    media_tempo_formatada TEXT,
    media_tempo_minutos INTEGER DEFAULT 0,
    historico_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    usuarios_lista JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentários da tabela
COMMENT ON TABLE public.tasy_snapshots_diarios IS 'Armazena os snapshots diários de conexões e usuários do Tasy às 23:50';
COMMENT ON COLUMN public.tasy_snapshots_diarios.data_referencia IS 'Data de referência do snapshot (YYYY-MM-DD)';
COMMENT ON COLUMN public.tasy_snapshots_diarios.historico_slots IS 'Array com os intervalos de 10 em 10 minutos e contagem de conexões do dia';
COMMENT ON COLUMN public.tasy_snapshots_diarios.usuarios_lista IS 'Lista detalhada de usuários logados no momento do fechamento';

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_tasy_snapshots_data_referencia ON public.tasy_snapshots_diarios(data_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_tasy_snapshots_created_at ON public.tasy_snapshots_diarios(created_at DESC);

-- 4. Habilita Row Level Security (RLS)
ALTER TABLE public.tasy_snapshots_diarios ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem para evitar duplicidade
DROP POLICY IF EXISTS "Permitir leitura de snapshots para usuários autenticados" ON public.tasy_snapshots_diarios;
DROP POLICY IF EXISTS "Permitir inserção e atualização de snapshots para usuários autenticados" ON public.tasy_snapshots_diarios;
DROP POLICY IF EXISTS "Permitir leitura pública de snapshots" ON public.tasy_snapshots_diarios;

-- Políticas de RLS
CREATE POLICY "Permitir leitura de snapshots para usuários autenticados"
    ON public.tasy_snapshots_diarios
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Permitir inserção e atualização de snapshots para usuários autenticados"
    ON public.tasy_snapshots_diarios
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Permissão para anon/service_role caso necessário
CREATE POLICY "Permitir leitura pública de snapshots"
    ON public.tasy_snapshots_diarios
    FOR SELECT
    TO anon
    USING (true);

-- 5. Configuração do Bucket no Supabase Storage para armazenamento de prints
INSERT INTO storage.buckets (id, name, public)
VALUES ('tasy-snapshots', 'tasy-snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao Storage
DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir leitura pública do bucket tasy-snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir upload autenticado no bucket tasy-snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir update autenticado no bucket tasy-snapshots" ON storage.objects;

    CREATE POLICY "Permitir leitura pública do bucket tasy-snapshots"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'tasy-snapshots');

    CREATE POLICY "Permitir upload autenticado no bucket tasy-snapshots"
        ON storage.objects FOR INSERT
        TO authenticated, anon, service_role
        WITH CHECK (bucket_id = 'tasy-snapshots');

    CREATE POLICY "Permitir update autenticado no bucket tasy-snapshots"
        ON storage.objects FOR UPDATE
        TO authenticated, anon, service_role
        USING (bucket_id = 'tasy-snapshots');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 6. Adiciona a tabela à publicação Realtime do Supabase
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.tasy_snapshots_diarios;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 7. Configuração do Cron Job para rodar todos os dias às 23:50 (Horário de Brasília)
-- No fuso UTC, 23:50 BRT (UTC-3) corresponde a 02:50 UTC do dia seguinte -> '50 2 * * *'
DO $$
BEGIN
    -- Remove agendamento anterior se existir
    PERFORM cron.unschedule('sync-tasy-snapshot-daily-2350');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
    'sync-tasy-snapshot-daily-2350',
    '50 2 * * *',
    $$
    SELECT
        net.http_post(
            url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-tasy-snapshot',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
            body := '{}'::jsonb
        );
    $$
);

COMMENT ON COLUMN cron.job.jobname IS 'Cron job diário às 23:50 BRT para salvar snapshot de usuários Tasy no Supabase';
