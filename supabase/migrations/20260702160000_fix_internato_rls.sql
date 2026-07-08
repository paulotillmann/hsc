-- Migração para corrigir RLS do módulo de Internato de Medicina
-- Criada em: 02/07/2026

BEGIN;

-- 1. Criar função auxiliar segura para verificar acesso aos módulos ou administrador
CREATE OR REPLACE FUNCTION public.has_internato_role(user_id UUID, module_slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.role_module_permissions rmp ON p.role_id = rmp.role_id
    JOIN public.modules m ON rmp.module_id = m.id
    WHERE p.id = user_id
      AND m.slug = module_slug
      AND m.is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_id
      AND p.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da função
COMMENT ON FUNCTION public.has_internato_role IS 'Verifica de forma segura se o usuário possui acesso ao módulo de internato ou se é administrador.';

-- 2. Revogar políticas RLS antigas (excessivamente permissivas)
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_turmas" ON public.internato_turmas;
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_alunos" ON public.internato_alunos;
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_turma_alunos" ON public.internato_turma_alunos;
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_presencas" ON public.internato_presencas;
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_atestados" ON public.internato_atestados;
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_notas" ON public.internato_notas;
DROP POLICY IF EXISTS "Acesso completo para autenticados em internato_reposicoes" ON public.internato_reposicoes;

-- 3. Criar novas políticas RLS granulares

-- 3.1 internato_turmas
CREATE POLICY "Permitir leitura de turmas para secretaria ou notas" 
  ON public.internato_turmas FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de turmas apenas para secretaria" 
  ON public.internato_turmas FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.2 internato_alunos
CREATE POLICY "Permitir leitura de alunos para secretaria ou notas" 
  ON public.internato_alunos FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de alunos apenas para secretaria" 
  ON public.internato_alunos FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.3 internato_turma_alunos
CREATE POLICY "Permitir leitura de turma_alunos para secretaria ou notas" 
  ON public.internato_turma_alunos FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de turma_alunos apenas para secretaria" 
  ON public.internato_turma_alunos FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.4 internato_presencas
CREATE POLICY "Permitir leitura de presencas para secretaria ou notas" 
  ON public.internato_presencas FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de presencas apenas para secretaria" 
  ON public.internato_presencas FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.5 internato_atestados
CREATE POLICY "Permitir leitura de atestados para secretaria ou notas" 
  ON public.internato_atestados FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de atestados apenas para secretaria" 
  ON public.internato_atestados FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.6 internato_reposicoes
CREATE POLICY "Permitir leitura de reposicoes para secretaria ou notas" 
  ON public.internato_reposicoes FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de reposicoes apenas para secretaria" 
  ON public.internato_reposicoes FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.7 internato_notas
CREATE POLICY "Permitir leitura de notas para secretaria ou notas" 
  ON public.internato_notas FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

CREATE POLICY "Permitir escrita de notas para secretaria ou notas" 
  ON public.internato_notas FOR ALL TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria') OR public.has_internato_role(auth.uid(), 'internato-notas'));

COMMIT;
