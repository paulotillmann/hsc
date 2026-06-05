-- Migração para criação do log de estágios de Ordens de Serviço
-- Criada em: 2026-06-03

-- 1. Criar a função auxiliar para calcular o estágio Kanban
CREATE OR REPLACE FUNCTION public.calcular_estagio_kanban(
  ds_estagio VARCHAR,
  ds_situacao VARCHAR,
  nm_usuario_encer VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  situacao_lower VARCHAR;
  estagio_lower VARCHAR;
  encer_trimmed VARCHAR;
BEGIN
  situacao_lower := COALESCE(LOWER(ds_situacao), '');
  estagio_lower := COALESCE(LOWER(ds_estagio), '');
  encer_trimmed := COALESCE(TRIM(nm_usuario_encer), '');

  -- 1. Finalizado (ou Encerrado)
  IF situacao_lower LIKE '%finalizada%' OR 
     situacao_lower LIKE '%finalizado%' OR 
     situacao_lower LIKE '%encerrada%' OR 
     situacao_lower LIKE '%concluída%' OR 
     situacao_lower LIKE '%concluido%' OR 
     encer_trimmed <> '' OR 
     estagio_lower LIKE '%encerrad%' THEN
    RETURN 'finalizado';
  END IF;

  -- 2. Triagem (Ordens de Serviço com DS Estagio em branco ou nulo)
  IF TRIM(ds_estagio) = '' OR ds_estagio IS NULL THEN
    RETURN 'triagem';
  END IF;

  -- 3. Em processo (ds_estagio = Iniciada ou Em Desenvolvimento)
  IF estagio_lower = 'iniciada' OR estagio_lower = 'em desenvolvimento' THEN
    RETURN 'processo';
  END IF;

  -- 4. Escalonado (todos os outros menos encerrado)
  RETURN 'escalonado';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Criar a tabela ordem_servico_estagio_log
CREATE TABLE IF NOT EXISTS public.ordem_servico_estagio_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nr_sequencia INTEGER NOT NULL,
  estagio_kanban VARCHAR(50) NOT NULL, -- 'triagem', 'processo', 'escalonado', 'finalizado'
  dt_transicao TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT ordem_servico_estagio_log_pkey PRIMARY KEY (id),
  CONSTRAINT fk_estagio_log_nr_sequencia FOREIGN KEY (nr_sequencia) REFERENCES public.ordem_servico(nr_sequencia) ON DELETE CASCADE
);

-- Comentários para documentação
COMMENT ON TABLE public.ordem_servico_estagio_log IS 'Tabela que armazena o log de transição de estágios das ordens de serviço';

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.ordem_servico_estagio_log ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança (RLS Policies)
CREATE POLICY "Permitir leitura de log de estagio para autenticados" 
  ON public.ordem_servico_estagio_log 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Permitir controle total de logs para service_role" 
  ON public.ordem_servico_estagio_log 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 5. Criação de índices para performance nas consultas
CREATE INDEX IF NOT EXISTS idx_os_estagio_log_nr_sequencia ON public.ordem_servico_estagio_log(nr_sequencia);
CREATE INDEX IF NOT EXISTS idx_os_estagio_log_dt_transicao ON public.ordem_servico_estagio_log(dt_transicao ASC);

-- 6. Função do Trigger para registrar as transições de estágio
CREATE OR REPLACE FUNCTION public.handle_ordem_servico_estagio_log()
RETURNS TRIGGER AS $$
DECLARE
  estagio_antigo VARCHAR;
  estagio_novo VARCHAR;
  dt_transicao_calc TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calcular o novo estágio do registro
  estagio_novo := public.calcular_estagio_kanban(NEW.ds_estagio, NEW.ds_situacao, NEW.nm_usuario_encer);

  -- Definir a data da transição (usar dt_atualizacao se disponível, senão dt_ordem_servico ou agora)
  dt_transicao_calc := COALESCE(NEW.dt_atualizacao, NEW.dt_ordem_servico, now());

  IF (TG_OP = 'INSERT') THEN
    -- Todo chamado começa na triagem (na data de abertura)
    INSERT INTO public.ordem_servico_estagio_log (nr_sequencia, estagio_kanban, dt_transicao)
    VALUES (NEW.nr_sequencia, 'triagem', COALESCE(NEW.dt_ordem_servico, now()));

    -- Se o estágio inicial no momento da inserção já for diferente de 'triagem', grava a transição correspondente
    IF estagio_novo <> 'triagem' THEN
      INSERT INTO public.ordem_servico_estagio_log (nr_sequencia, estagio_kanban, dt_transicao)
      VALUES (NEW.nr_sequencia, estagio_novo, dt_transicao_calc);
    END IF;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Calcular o estágio antigo
    estagio_antigo := public.calcular_estagio_kanban(OLD.ds_estagio, OLD.ds_situacao, OLD.nm_usuario_encer);

    -- Se o estágio calculável mudou, grava o log
    IF estagio_novo <> estagio_antigo THEN
      INSERT INTO public.ordem_servico_estagio_log (nr_sequencia, estagio_kanban, dt_transicao)
      VALUES (NEW.nr_sequencia, estagio_novo, dt_transicao_calc);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Criar o Trigger na tabela ordem_servico
CREATE OR REPLACE TRIGGER trigger_log_ordem_servico_estagio
  AFTER INSERT OR UPDATE ON public.ordem_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ordem_servico_estagio_log();

-- 8. Carga inicial retrospectiva para os registros de OS existentes
-- 8.1 Inserir log inicial de 'triagem' baseado em dt_ordem_servico
INSERT INTO public.ordem_servico_estagio_log (nr_sequencia, estagio_kanban, dt_transicao, created_at)
SELECT 
  nr_sequencia, 
  'triagem', 
  COALESCE(dt_ordem_servico, created_at, now()),
  COALESCE(created_at, now())
FROM public.ordem_servico
ON CONFLICT DO NOTHING;

-- 8.2 Inserir log do estágio atual se ele for diferente de 'triagem'
INSERT INTO public.ordem_servico_estagio_log (nr_sequencia, estagio_kanban, dt_transicao, created_at)
SELECT 
  nr_sequencia, 
  public.calcular_estagio_kanban(ds_estagio, ds_situacao, nm_usuario_encer) AS estagio_atual, 
  COALESCE(dt_atualizacao, updated_at, now()),
  COALESCE(updated_at, now())
FROM public.ordem_servico
WHERE public.calcular_estagio_kanban(ds_estagio, ds_situacao, nm_usuario_encer) <> 'triagem'
ON CONFLICT DO NOTHING;
