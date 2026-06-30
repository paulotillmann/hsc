-- Migração para deletar Ordens de Serviço enviadas por erro que pertencem ao grupo de Manutenção
-- Criada em: 2026-06-30

DELETE FROM public.ordem_servico 
WHERE ds_grupo_des ILIKE '%manuten%' 
   OR ds_grupo_des ILIKE '%manutenção%';
