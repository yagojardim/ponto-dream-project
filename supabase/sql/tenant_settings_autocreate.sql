-- ============================================================================
-- Todo tenant novo ganha a linha de tenant_settings (cota de armazenamento Free).
--
-- Problema: o auto-cadastro cria o tenant mas não cria tenant_settings, então a
-- cota fica "0 B de 0 B" (storage.ts lê storage_quota_bytes dessa linha).
--
-- O que faz (idempotente):
--   1) trigger AFTER INSERT em tenants que cria a linha com os DEFAULTS da tabela
--      (Free: 1 GB, 10 MB/arquivo, 100 arquivos/projeto);
--   2) backfill: tenants que já existem sem a linha passam a ter uma.
-- admin_master_status nasce 'defined' (igual ao comportamento de hoje, em que
-- "sem linha" = definido): o overlay de eleição NÃO reabre para ninguém.
-- ============================================================================

create schema if not exists app;

create or replace function app.tg_tenants_create_settings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.tenant_settings (tenant_id, admin_master_status, admin_master_defined_method, admin_master_defined_at)
  values (new.id, 'defined', 'self_elected', now())
  on conflict (tenant_id) do nothing;
  return new;
end;
$fn$;

revoke all on function app.tg_tenants_create_settings() from public, anon, authenticated;

drop trigger if exists tg_tenants_create_settings on public.tenants;
create trigger tg_tenants_create_settings
  after insert on public.tenants
  for each row execute function app.tg_tenants_create_settings();

-- Backfill: tenants existentes sem linha de settings
insert into public.tenant_settings (tenant_id, admin_master_status, admin_master_defined_method, admin_master_defined_at)
select t.id, 'defined',
       case when exists (select 1 from public.profiles p where p.tenant_id = t.id and p.tenant_owner)
            then 'self_elected' end,
       now()
from public.tenants t
where not exists (select 1 from public.tenant_settings s where s.tenant_id = t.id);

notify pgrst, 'reload schema';
