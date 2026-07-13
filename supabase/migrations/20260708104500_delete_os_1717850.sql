-- Migração para remover a OS 1717850 do Supabase
-- Motivo: Alterada no Tasy para o grupo de Manutenção (não pertence mais ao TI)
-- Criada em: 2026-07-08

DELETE FROM public.ordem_servico 
WHERE nr_sequencia = 1717850;
