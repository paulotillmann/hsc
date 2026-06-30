-- Alterar a coluna nota para permitir valores maiores (ex: até 100.00)
ALTER TABLE public.internato_notas 
  ALTER COLUMN nota TYPE NUMERIC(5, 2);

-- Remover a constraint antiga se existir
ALTER TABLE public.internato_notas 
  DROP CONSTRAINT IF EXISTS internato_notas_nota_check;

-- Adicionar a nova constraint que permite notas de 0 a 100
ALTER TABLE public.internato_notas 
  ADD CONSTRAINT internato_notas_nota_check CHECK (nota >= 0.00 AND nota <= 100.00);
