-- =====================================================================
-- MIGRATION: CRIAÇÃO DO CANAL DE ESCUTA SANTA CASA
-- DATA: 25/05/2026
-- DESCRITIVO: Criação das tabelas de denúncias e logs de conformidade
--              com políticas de RLS avançadas para privacidade.
-- =====================================================================

-- 1. TABELA DE DENÚNCIAS
CREATE TABLE IF NOT EXISTS public.denuncias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    categoria_label TEXT NOT NULL,
    descricao TEXT NOT NULL,
    data_submetida TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_ocorrencia DATE,
    local_ocorrencia TEXT,
    anonimo BOOLEAN NOT NULL DEFAULT true,
    nome_relator TEXT,
    email_relator TEXT,
    telefone_relator TEXT,
    cargo_relator TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    prioridade TEXT NOT NULL DEFAULT 'Baixa',
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    anexos TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE LOGS DE AUDITORIA (IP BLINDADO POR PRIVACIDADE)
CREATE TABLE IF NOT EXISTS public.denuncia_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    protocolo TEXT NOT NULL,
    acao TEXT NOT NULL,
    usuario TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT '[IP BLINDADO POR SEGURANÇA]'
);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncia_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURANÇA (RLS & RBAC) PARA A TABELA 'DENUNCIAS'

-- a) Qualquer pessoa (inclusive anônimos) pode enviar um novo relato
CREATE POLICY "Permitir submissão pública de relatos" 
ON public.denuncias 
FOR INSERT 
WITH CHECK (true);

-- b) Apenas usuários administradores (role = 'admin') podem ler os relatos
CREATE POLICY "Apenas administradores podem visualizar relatos" 
ON public.denuncias 
FOR SELECT 
USING (
    exists (
        select 1 from public.profiles 
        where profiles.id = auth.uid() 
        and profiles.role = 'admin'
    )
);

-- c) Apenas usuários administradores podem atualizar/gerir relatos
CREATE POLICY "Apenas administradores podem atualizar relatos" 
ON public.denuncias 
FOR UPDATE 
USING (
    exists (
        select 1 from public.profiles 
        where profiles.id = auth.uid() 
        and profiles.role = 'admin'
    )
);

-- d) Apenas usuários administradores podem deletar relatos
CREATE POLICY "Apenas administradores podem deletar relatos" 
ON public.denuncias 
FOR DELETE 
USING (
    exists (
        select 1 from public.profiles 
        where profiles.id = auth.uid() 
        and profiles.role = 'admin'
    )
);

-- 5. POLÍTICAS DE SEGURANÇA PARA A TABELA 'DENUNCIA_AUDIT_LOGS'

-- a) Apenas administradores podem ler logs de auditoria
CREATE POLICY "Apenas administradores podem ler logs de auditoria" 
ON public.denuncia_audit_logs 
FOR SELECT 
USING (
    exists (
        select 1 from public.profiles 
        where profiles.id = auth.uid() 
        and profiles.role = 'admin'
    )
);

-- b) Apenas administradores ou o sistema podem inserir logs de auditoria
CREATE POLICY "Apenas administradores podem registrar logs de auditoria" 
ON public.denuncia_audit_logs 
FOR INSERT 
WITH CHECK (
    exists (
        select 1 from public.profiles 
        where profiles.id = auth.uid() 
        and profiles.role = 'admin'
    )
);

-- 6. ÍNDICES DE DESEMPENHO E PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_denuncias_protocolo ON public.denuncias(protocolo);
CREATE INDEX IF NOT EXISTS idx_denuncias_status ON public.denuncias(status);
CREATE INDEX IF NOT EXISTS idx_denuncias_prioridade ON public.denuncias(prioridade);
CREATE INDEX IF NOT EXISTS idx_denuncias_created_at ON public.denuncias(created_at);

-- 7. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE 'UPDATED_AT'
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_denuncias_updated_at
    BEFORE UPDATE ON public.denuncias
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
