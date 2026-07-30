-- Cria o bucket 'novidades' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('novidades', 'novidades', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de segurança para o bucket 'novidades'
-- Nota: Habilitar leitura pública para qualquer pessoa
CREATE POLICY "Permitir leitura publica do bucket novidades" ON storage.objects
  FOR SELECT USING (bucket_id = 'novidades');

-- Permitir inserção de arquivos apenas por administradores
DROP POLICY IF EXISTS "Permitir insercao no bucket novidades para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir insercao no bucket novidades para administradores" ON storage.objects;
CREATE POLICY "Permitir insercao no bucket novidades para administradores" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'novidades' AND
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Permitir exclusão de arquivos apenas por administradores
DROP POLICY IF EXISTS "Permitir exclusao no bucket novidades para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao no bucket novidades para administradores" ON storage.objects;
CREATE POLICY "Permitir exclusao no bucket novidades para administradores" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'novidades' AND
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
