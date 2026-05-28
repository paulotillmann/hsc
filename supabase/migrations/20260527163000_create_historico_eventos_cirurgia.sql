-- Migração para criação da tabela de histórico de eventos de cirurgias
-- Criada em: 2026-05-27

CREATE TABLE IF NOT EXISTS public.historico_eventos_cirurgia (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nr_cirurgia INTEGER NOT NULL REFERENCES public.cirurgias(nr_cirurgia) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  dt_registro TIMESTAMP WITH TIME ZONE NOT NULL,
  dt_evento TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT historico_eventos_cirurgia_pkey PRIMARY KEY (id),
  CONSTRAINT unique_cirurgia_evento UNIQUE (nr_cirurgia, evento)
);

-- Comentários para documentação
COMMENT ON TABLE public.historico_eventos_cirurgia IS 'Tabela que armazena o histórico completo de eventos de cada cirurgia';
COMMENT ON COLUMN public.historico_eventos_cirurgia.nr_cirurgia IS 'Chave de negócio que identifica a cirurgia';
COMMENT ON COLUMN public.historico_eventos_cirurgia.evento IS 'Nome do evento cirúrgico registrado';
COMMENT ON COLUMN public.historico_eventos_cirurgia.dt_registro IS 'Data e hora em que o evento ocorreu no sistema de origem';
COMMENT ON COLUMN public.historico_eventos_cirurgia.dt_evento IS 'Data e hora da ocorrência do evento para fins de análise de tempos e movimentos';

-- Habilitar RLS
ALTER TABLE public.historico_eventos_cirurgia ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura de historico para usuarios autenticados"
  ON public.historico_eventos_cirurgia
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir controle total de historico para service_role"
  ON public.historico_eventos_cirurgia
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_historico_eventos_nr_cirurgia ON public.historico_eventos_cirurgia(nr_cirurgia);
CREATE INDEX IF NOT EXISTS idx_historico_eventos_dt_registro ON public.historico_eventos_cirurgia(dt_registro);
CREATE INDEX IF NOT EXISTS idx_historico_eventos_dt_evento ON public.historico_eventos_cirurgia(dt_evento);
