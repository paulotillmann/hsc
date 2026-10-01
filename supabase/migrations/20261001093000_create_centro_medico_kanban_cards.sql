-- Migração para armazenar as posições e status fixos dos cards do Kanban do Centro Médico
-- Criada em: 2026-10-01

CREATE TABLE IF NOT EXISTS public.centro_medico_kanban_cards (
  card_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  paciente TEXT,
  data_consulta TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.centro_medico_kanban_cards IS 'Armazena a posição manual fixada de cada agendamento no Kanban do Centro Médico';

-- Habilitar RLS
ALTER TABLE public.centro_medico_kanban_cards ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'centro_medico_kanban_cards' AND policyname = 'Permitir leitura de cards do kanban'
    ) THEN
        CREATE POLICY "Permitir leitura de cards do kanban"
        ON public.centro_medico_kanban_cards
        FOR SELECT
        TO authenticated, anon
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'centro_medico_kanban_cards' AND policyname = 'Permitir salvar status do kanban'
    ) THEN
        CREATE POLICY "Permitir salvar status do kanban"
        ON public.centro_medico_kanban_cards
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
