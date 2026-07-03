-- Migração para ajustar a política de RLS na tabela de solicitações de prontuário
-- Permitindo a inserção de solicitações por qualquer usuário (anon/authenticated) para que pacientes possam registrar solicitações
-- Criada em: 2026-07-03

-- 1. Remover política antiga que restringia apenas a usuários logados
DROP POLICY IF EXISTS "Permitir inserção de solicitações para autenticados" ON public.solicitacoes_prontuario;

-- 2. Criar nova política que permite inserção pública
CREATE POLICY "Permitir inserção de solicitações para todos" 
ON public.solicitacoes_prontuario 
FOR INSERT 
TO public 
WITH CHECK (true);
