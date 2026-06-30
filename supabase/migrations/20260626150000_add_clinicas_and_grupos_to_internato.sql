-- Migração para adicionar controle de clínicas e grupos de rodízio no Internato
-- Criada em: 2026-06-26

-- 1. Adicionar coluna grupo à tabela de junção internato_turma_alunos
ALTER TABLE public.internato_turma_alunos 
ADD COLUMN IF NOT EXISTS grupo VARCHAR(10);

-- 2. Adicionar coluna clinica à tabela de presencas
ALTER TABLE public.internato_presencas 
ADD COLUMN IF NOT EXISTS clinica VARCHAR(50) DEFAULT 'Geral' NOT NULL;

-- 3. Adicionar coluna clinica à tabela de notas
ALTER TABLE public.internato_notas 
ADD COLUMN IF NOT EXISTS clinica VARCHAR(50) DEFAULT 'Geral' NOT NULL;

-- 4. Atualizar a constraint de unicidade na tabela de notas para considerar a clinica
ALTER TABLE public.internato_notas 
DROP CONSTRAINT IF EXISTS internato_notas_unique;

ALTER TABLE public.internato_notas 
ADD CONSTRAINT internato_notas_unique UNIQUE (turma_id, aluno_id, clinica, descricao);
