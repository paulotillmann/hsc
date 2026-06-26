-- =====================================================================
-- MIGRATION: CRIAÇÃO DO MÓDULO DE GESTÃO DE PRONTUÁRIOS
-- DATA: 22/06/2026
-- DESCRITIVO: Criação das tabelas de solicitações de prontuário,
--              histórico, RLS, Bucket de Storage e registro do módulo.
-- =====================================================================

-- 1. TABELA DE SOLICITAÇÕES DE PRONTUÁRIO
CREATE TABLE IF NOT EXISTS public.solicitacoes_prontuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_solicitacao SERIAL,
    paciente_nome TEXT NOT NULL,
    paciente_cpf TEXT NOT NULL,
    paciente_data_nascimento DATE NOT NULL,
    paciente_contato TEXT NOT NULL,
    motivo TEXT NOT NULL,
    observacoes TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    responsavel_nome TEXT,
    data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
    tipo_solicitacao TEXT NOT NULL DEFAULT 'Digital',
    justificativa_rejeicao TEXT,
    arquivo_url TEXT,
    arquivo_nome TEXT,
    data_finalizacao TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE HISTÓRICO DE MOVIMENTAÇÃO (RASTREABILIDADE)
CREATE TABLE IF NOT EXISTS public.historico_solicitacoes_prontuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_prontuario(id) ON DELETE CASCADE,
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    usuario_nome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.solicitacoes_prontuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_solicitacoes_prontuario ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURANÇA (RLS)
-- Permitir leitura de solicitações para qualquer usuário autenticado
CREATE POLICY "Permitir leitura de solicitações para autenticados" 
ON public.solicitacoes_prontuario 
FOR SELECT 
TO authenticated 
USING (true);

-- Permitir inserção de solicitações (pode ser pública se pacientes submeterem sem login, ou autenticado para testes)
CREATE POLICY "Permitir inserção de solicitações para autenticados" 
ON public.solicitacoes_prontuario 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Permitir atualização de solicitações para qualquer usuário autenticado
CREATE POLICY "Permitir atualização de solicitações para autenticados" 
ON public.solicitacoes_prontuario 
FOR UPDATE 
TO authenticated 
USING (true);

-- Permitir exclusão de solicitações para autenticados (opcional, ex: admins)
CREATE POLICY "Permitir exclusão de solicitações para autenticados" 
ON public.solicitacoes_prontuario 
FOR DELETE 
TO authenticated 
USING (true);

-- Políticas para tabela de histórico
CREATE POLICY "Permitir leitura de histórico para autenticados" 
ON public.historico_solicitacoes_prontuario 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção de histórico para autenticados" 
ON public.historico_solicitacoes_prontuario 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 5. REGISTRAR O MÓDULO NA TABELA 'modules'
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Gestão de Prontuários', 
  'gestao-prontuarios', 
  'FileSpreadsheet', 
  'Recebimento, análise, aprovação ou rejeição de solicitações de prontuários com entrega segura de documentos.', 
  true, 
  85, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'gestao-prontuarios'
);

-- 6. ATRIBUIR O MÓDULO PARA TODAS AS ROLES EXISTENTES POR PADRÃO
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'gestao-prontuarios'
ON CONFLICT DO NOTHING;

-- 7. CONFIGURAR O BUCKET DO STORAGE PARA OS PRONTUÁRIOS EM PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'prontuarios-pdfs', 
    'prontuarios-pdfs', 
    true, 
    52428800, -- 50MB
    '{"application/pdf"}'
)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS no bucket se necessário (normalmente herdado de storage.objects)
-- Políticas para storage.objects (Permissões de upload/leitura no Bucket)
CREATE POLICY "Permitir upload em prontuarios-pdfs para autenticados"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'prontuarios-pdfs');

CREATE POLICY "Permitir leitura em prontuarios-pdfs para qualquer um"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'prontuarios-pdfs');

CREATE POLICY "Permitir exclusão em prontuarios-pdfs para autenticados"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'prontuarios-pdfs');

-- 8. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE 'UPDATED_AT'
CREATE OR REPLACE FUNCTION public.handle_prontuarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_solicitacoes_prontuario_updated_at
    BEFORE UPDATE ON public.solicitacoes_prontuario
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_prontuarios_updated_at();

-- 9. DADOS SIMULADOS (MOCK DATA) PARA DESENVOLVIMENTO
INSERT INTO public.solicitacoes_prontuario 
(id, paciente_nome, paciente_cpf, paciente_data_nascimento, paciente_contato, motivo, observacoes, status, tipo_solicitacao, data_solicitacao)
VALUES 
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'João da Silva',
    '123.456.789-00',
    '1985-05-15',
    '(11) 98765-4321 / joao.silva@email.com',
    'Necessidade de apresentação do prontuário para consulta com médico especialista em outra instituição.',
    'Solicitou urgência no envio.',
    'Pendente',
    'Digital',
    now() - interval '2 days'
),
(
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Maria Oliveira Santos',
    '987.654.321-11',
    '1992-08-20',
    '(11) 99999-8888 / maria.santos@email.com',
    'Acompanhamento de histórico cirúrgico anterior realizado no HSC em 2024.',
    'Prefere receber por e-mail.',
    'Em Análise',
    'Digital',
    now() - interval '1 day'
),
(
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'Carlos Eduardo Souza',
    '456.789.123-22',
    '1970-11-02',
    '(11) 97777-6666 / carlos.souza@email.com',
    'Retirada de prontuário físico para apresentação em junta médica pericial do INSS.',
    'Retirará pessoalmente na recepção se aprovado.',
    'Aprovado',
    'Físico',
    now() - interval '3 days'
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    'Ana Beatriz Ferreira',
    '789.123.456-33',
    '2000-01-30',
    '(11) 96666-5555 / ana.ferreira@email.com',
    'Solicitação para fins de seguro de saúde e reembolso de despesas de internação.',
    'Requer cópia integral.',
    'Rejeitado',
    'Digital',
    now() - interval '4 days'
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'Pedro Henrique Alves',
    '321.654.987-44',
    '1963-04-10',
    '(11) 95555-4444 / pedro.alves@email.com',
    'Exames e relatórios médicos de internação do ano de 2025.',
    'Necessita apenas do relatório de alta.',
    'Documento Disponibilizado',
    'Digital',
    now() - interval '5 days'
)
ON CONFLICT (id) DO NOTHING;

-- Registrar histórico inicial dos dados mockados
INSERT INTO public.historico_solicitacoes_prontuario
(solicitacao_id, status_anterior, status_novo, descricao, usuario_nome, data)
VALUES
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    NULL,
    'Pendente',
    'Solicitação realizada pelo paciente via portal.',
    'Paciente (João da Silva)',
    now() - interval '2 days'
),
(
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    NULL,
    'Pendente',
    'Solicitação realizada pelo paciente via portal.',
    'Paciente (Maria Oliveira Santos)',
    now() - interval '1 day'
),
(
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Pendente',
    'Em Análise',
    'Análise da solicitação iniciada pelo gestor.',
    'Gestor de Teste',
    now() - interval '12 hours'
),
(
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    NULL,
    'Pendente',
    'Solicitação realizada pelo paciente via portal.',
    'Paciente (Carlos Eduardo Souza)',
    now() - interval '3 days'
),
(
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'Pendente',
    'Em Análise',
    'Análise da solicitação iniciada pelo gestor.',
    'Gestor de Teste',
    now() - interval '2 days 18 hours'
),
(
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'Em Análise',
    'Aprovado',
    'Solicitação aprovada. Aguardando upload do arquivo do prontuário.',
    'Gestor de Teste',
    now() - interval '2 days 12 hours'
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    NULL,
    'Pendente',
    'Solicitação realizada pelo paciente via portal.',
    'Paciente (Ana Beatriz Ferreira)',
    now() - interval '4 days'
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    'Pendente',
    'Em Análise',
    'Análise da solicitação iniciada pelo gestor.',
    'Gestor de Teste',
    now() - interval '3 days 18 hours'
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    'Em Análise',
    'Rejeitado',
    'Solicitação rejeitada. Motivo: Falta de documento de identificação com foto em anexo.',
    'Gestor de Teste',
    now() - interval '3 days 12 hours'
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    NULL,
    'Pendente',
    'Solicitação realizada pelo paciente via portal.',
    'Paciente (Pedro Henrique Alves)',
    now() - interval '5 days'
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'Pendente',
    'Em Análise',
    'Análise da solicitação iniciada pelo gestor.',
    'Gestor de Teste',
    now() - interval '4 days 18 hours'
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'Em Análise',
    'Aprovado',
    'Solicitação aprovada. Aguardando upload do arquivo do prontuário.',
    'Gestor de Teste',
    now() - interval '4 days 12 hours'
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'Aprovado',
    'Documento Disponibilizado',
    'Documento do prontuário anexado e disponibilizado para o solicitante.',
    'Gestor de Teste',
    now() - interval '4 days'
)
ON CONFLICT (id) DO NOTHING;

-- Configurar dados adicionais nas solicitações finalizadas
UPDATE public.solicitacoes_prontuario
SET 
    responsavel_nome = 'Gestor de Teste',
    data_finalizacao = now() - interval '4 days',
    arquivo_nome = 'PRONTUARIO_PEDRO_ALVES.pdf',
    arquivo_url = 'https://mock.url/prontuarios/PRONTUARIO_PEDRO_ALVES.pdf'
WHERE id = 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b';

UPDATE public.solicitacoes_prontuario
SET 
    responsavel_nome = 'Gestor de Teste',
    justificativa_rejeicao = 'Falta de documento de identificação com foto em anexo.',
    data_finalizacao = now() - interval '3 days 12 hours'
WHERE id = 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a';

UPDATE public.solicitacoes_prontuario
SET 
    responsavel_nome = 'Gestor de Teste'
WHERE id IN ('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f');
