-- tenant_settings: leitura para todo o tenant; escrita só para o Admin do tenant.
-- APLICADO no Supabase em 13/10/2026 (migração tenant_settings_admin_write), com aprovação do usuário.
-- Antes: uma única política FOR ALL deixava qualquer usuário do tenant alterar cota, plano,
-- Admin Master, governança de relatórios e a aparência da empresa.
-- Teste (simulação desfeita): antes não-admin alterava = 1; depois admin altera = 1,
-- não-admin lê = 1 e altera = 0.
-- Para voltar atrás: tenant_settings_admin_write_rollback.sql
begin;

drop policy if exists tenant_settings_tenant_scope on public.tenant_settings;

create policy tenant_settings_read_tenant on public.tenant_settings
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy tenant_settings_admin_insert on public.tenant_settings
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

create policy tenant_settings_admin_update on public.tenant_settings
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_tenant_admin())
  with check (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

create policy tenant_settings_admin_delete on public.tenant_settings
  for delete to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

commit;
