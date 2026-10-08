-- ============================================================================
-- Storage — bucket "attachments" (v2, alinhado ao rls_lockdown_v2).
--
-- Problema confirmado em produção: a chave pública (anon) LISTA pastas e arquivos
-- do bucket de anexos (policies de inspeção em storage.objects valem por bucket_id,
-- sem escopo de tenant, e policies permissivas se somam com OR).
--
-- O que faz:
--   1) remove as policies de inspeção e qualquer policy de anon/public do bucket;
--   2) recria policies POR TENANT, só para usuários logados (convenção de path:
--      <tenant_id>/<projeto>/...), usando app.current_tenant_id();
--   3) torna o bucket PRIVADO (o app só usa URL assinada: createSignedUrl).
--
-- Diferença para storage_attachments_lockdown.sql (v1): não devolve EXECUTE de
-- função SECURITY DEFINER ao authenticated (o lockdown v2 acabou de revogar) e
-- protege o que pode não existir. Pré-requisito: rls_lockdown_v2.sql aplicado
-- (cria app.current_tenant_id()). Idempotente; roda numa transação só.
-- ============================================================================

-- ─── 1. Remove policies abertas do bucket ───────────────────────────────────
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (policyname like '%insp%' or policyname like '%inspection%')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- qualquer policy que alcance anon/public e cite o bucket
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and ('anon' = any (roles) or 'public' = any (roles))
      and coalesce(qual, '') || coalesce(with_check, '') like '%attachments%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- ─── 2. Policies por tenant, só authenticated ───────────────────────────────
drop policy if exists attachments_tenant_select on storage.objects;
drop policy if exists attachments_tenant_insert on storage.objects;
drop policy if exists attachments_tenant_update on storage.objects;
drop policy if exists attachments_tenant_delete on storage.objects;

create policy attachments_tenant_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

create policy attachments_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

create policy attachments_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

create policy attachments_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

-- ─── 3. Bucket privado (o app usa só URL assinada) ──────────────────────────
update storage.buckets set public = false where id = 'attachments';

-- ─── 4. Wrapper antigo: fora do alcance de anon/public, se existir ──────────
do $$
begin
  if to_regprocedure('public.current_tenant_id()') is not null then
    revoke all on function public.current_tenant_id() from public, anon;
  end if;
end $$;

notify pgrst, 'reload schema';
