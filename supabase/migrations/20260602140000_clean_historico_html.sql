-- Migração para limpar tags HTML de dados legados nas tabelas de Ordem de Serviço
-- Criada em: 2026-06-02

-- 1. Limpar relatos existentes na tabela de histórico
UPDATE public.historico_ordem_servico
SET ds_relat_tecnico = trim(
  replace(
    replace(
      replace(
        replace(
          replace(
            regexp_replace(ds_relat_tecnico, '<[^>]*>', '', 'g'),
            '&nbsp;', ' '
          ),
          '&lt;', '<'
        ),
        '&gt;', '>'
      ),
      '&amp;', '&'
    ),
    '&quot;', '"'
  )
)
WHERE ds_relat_tecnico LIKE '%<%';

-- 2. Limpar a coluna ds_relat_tecnico e ds_dano existentes na tabela principal ordem_servico
UPDATE public.ordem_servico
SET 
  ds_relat_tecnico = CASE 
    WHEN ds_relat_tecnico IS NOT NULL THEN trim(
      replace(
        replace(
          replace(
            replace(
              replace(
                regexp_replace(ds_relat_tecnico, '<[^>]*>', '', 'g'),
                '&nbsp;', ' '
              ),
              '&lt;', '<'
            ),
            '&gt;', '>'
          ),
          '&amp;', '&'
        ),
        '&quot;', '"'
      )
    )
    ELSE NULL
  END,
  ds_dano = CASE 
    WHEN ds_dano IS NOT NULL THEN trim(
      replace(
        replace(
          replace(
            replace(
              replace(
                regexp_replace(ds_dano, '<[^>]*>', '', 'g'),
                '&nbsp;', ' '
              ),
              '&lt;', '<'
            ),
            '&gt;', '>'
          ),
          '&amp;', '&'
        ),
        '&quot;', '"'
      )
    )
    ELSE NULL
  END
WHERE ds_relat_tecnico LIKE '%<%' OR ds_dano LIKE '%<%';
