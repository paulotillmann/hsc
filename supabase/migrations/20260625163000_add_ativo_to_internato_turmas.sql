-- Migração para adicionar controle de arquivamento nas turmas do Internato
-- Criada em: 2026-06-25

ALTER TABLE public.internato_turmas 
ADD COLUMN ativa BOOLEAN DEFAULT true NOT NULL;
