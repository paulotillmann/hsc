-- Adiciona a coluna imagem_url na tabela novidades
ALTER TABLE public.novidades ADD COLUMN IF NOT EXISTS imagem_url text;
