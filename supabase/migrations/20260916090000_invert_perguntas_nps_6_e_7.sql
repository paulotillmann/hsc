-- Migration: Inverter ordem das perguntas 6 e 7 da pesquisa NPS
-- Pergunta 6 passa a ser: "O que podemos melhorar?" (feedback_negativo)
-- Pergunta 7 passa a ser: "O que você mais gostou no nosso atendimento?" (feedback_positivo)

UPDATE pesquisa_perguntas 
SET order_num = 6, 
    updated_at = NOW() 
WHERE id = 'feedback_negativo';

UPDATE pesquisa_perguntas 
SET order_num = 7, 
    updated_at = NOW() 
WHERE id = 'feedback_positivo';
