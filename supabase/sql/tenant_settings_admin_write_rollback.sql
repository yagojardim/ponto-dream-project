-- Volta atrás de tenant_settings_admin_write.sql: restaura a política única anterior (FOR ALL).
-- Só usar se a escrita restrita ao Admin causar problema.
begin;

drop policy if exists tenant_settings_read_tenant  on public.tenant_settings;
drop policy if exists tenant_settings_admin_insert on public.tenant_settings;
drop policy if exists tenant_settings_admin_update on public.tenant_settings;
drop policy if exists tenant_settings_admin_delete on public.tenant_settings;

create policy tenant_settings_tenant_scope on public.tenant_settings
  for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

commit;
