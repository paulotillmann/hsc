-- Adiciona a coluna 'ordem' na tabela 'novidades' se não existir
ALTER TABLE public.novidades ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0 NOT NULL;

-- Popula sequencialmente os dados atuais baseados na ordem de criação decrescente (as mais recentes ficam com menor ordem para manter a lógica atual no início)
WITH ordenado AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) - 1 AS seq
  FROM public.novidades
)
UPDATE public.novidades n
SET ordem = o.seq
FROM ordenado o
WHERE n.id = o.id;
