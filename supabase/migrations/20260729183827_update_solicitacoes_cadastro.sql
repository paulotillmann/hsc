-- =====================================================================
-- MIGRATION: EXTENSÃO DA GESTÃO DE SOLICITAÇÕES DE CADASTRO / ACESSO
-- DATA: 29/07/2026
-- DESCRITIVO: Adiciona campos de auditoria em solicitacoes_cadastro
--              e cria a tabela de histórico de movimentação.
-- =====================================================================

-- 1. ADICIONAR COLUNAS DE AUDITORIA NA TABELA DE CADASTRO
ALTER TABLE public.solicitacoes_cadastro 
ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS justificativa_rejeicao TEXT;

-- 2. CRIAR A TABELA DE HISTÓRICO DE MOVIMENTAÇÃO DE CADASTROS (RASTREABILIDADE)
CREATE TABLE IF NOT EXISTS public.historico_solicitacoes_cadastro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id INT NOT NULL REFERENCES public.solicitacoes_cadastro(id) ON DELETE CASCADE,
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    usuario_nome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.solicitacoes_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_solicitacoes_cadastro ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURANÇA (RLS) PARA SOLICITACOES_CADASTRO
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'solicitacoes_cadastro' AND policyname = 'Permitir leitura de cadastros para autenticados'
    ) THEN
        CREATE POLICY "Permitir leitura de cadastros para autenticados" 
        ON public.solicitacoes_cadastro 
        FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'solicitacoes_cadastro' AND policyname = 'Permitir inserção de cadastros para autenticados'
    ) THEN
        CREATE POLICY "Permitir inserção de cadastros para autenticados" 
        ON public.solicitacoes_cadastro 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'solicitacoes_cadastro' AND policyname = 'Permitir atualização de cadastros para autenticados'
    ) THEN
        CREATE POLICY "Permitir atualização de cadastros para autenticados" 
        ON public.solicitacoes_cadastro 
        FOR UPDATE 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'solicitacoes_cadastro' AND policyname = 'Permitir exclusão de cadastros para autenticados'
    ) THEN
        CREATE POLICY "Permitir exclusão de cadastros para autenticados" 
        ON public.solicitacoes_cadastro 
        FOR DELETE 
        TO authenticated 
        USING (true);
    END IF;
END $$;

-- POLÍTICAS DE SEGURANÇA (RLS) PARA HISTORICO_SOLICITACOES_CADASTRO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'historico_solicitacoes_cadastro' AND policyname = 'Permitir leitura de histórico de cadastros para autenticados'
    ) THEN
        CREATE POLICY "Permitir leitura de histórico de cadastros para autenticados" 
        ON public.historico_solicitacoes_cadastro 
        FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'historico_solicitacoes_cadastro' AND policyname = 'Permitir inserção de histórico de cadastros para autenticados'
    ) THEN
        CREATE POLICY "Permitir inserção de histórico de cadastros para autenticados" 
        ON public.historico_solicitacoes_cadastro 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;
END $$;

-- 5. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE 'UPDATED_AT'
CREATE OR REPLACE FUNCTION public.handle_cadastros_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_solicitacoes_cadastro_updated_at ON public.solicitacoes_cadastro;
CREATE TRIGGER trigger_update_solicitacoes_cadastro_updated_at
    BEFORE UPDATE ON public.solicitacoes_cadastro
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_cadastros_updated_at();
