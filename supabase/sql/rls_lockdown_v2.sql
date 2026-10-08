-- ============================================================================
-- RLS LOCKDOWN v2 — fecha o banco ao acesso anônimo e escopa tudo por tenant,
-- dono e papel, usando Supabase Auth. Substitui rls_lockdown.sql (v1), corrigido.
--
-- O que mudou em relação ao v1 (cada item foi achado lendo o app e o schema):
--   * app.is_tenant_admin(): usava roles.name, coluna que NÃO existe (é key/label)
--     — o v1 falharia ao criar a função.
--   * client_portal_users: escrita pela CAPACIDADE access:client-portal (Admin,
--     PMO, Project/Product Manager, PO), não só admin — senão o Gestão do Dash
--     View quebraria para esses papéis. (app.can_manage_portal)
--   * notifications: qualquer membro AVISA outro usuário do tenant (menções,
--     Admin Master); só o dono lê/altera/apaga.
--   * audit_logs: admin lê tudo; membros leem só tipos não sensíveis
--     (work_item = histórico do item, storage = cota).
--   * views v_tenant_storage / v_project_storage: passam a respeitar o RLS do
--     chamador (security_invoker) e saem do anon (o v1 não tratava views).
--   * public.ensure_fk: revogação protegida (a função pode não existir).
--
-- Pré-requisitos já aplicados: auth_link.sql, client_portal_auth.sql,
-- client_portal_fatia2.sql e rls_prep_link_profiles.sql (vínculo dos perfis).
-- NÃO rode sem antes passar pelo ensaio (rls_lockdown_v2_ensaio_tests.sql).
-- Idempotente. Roda numa transação só: se algo falhar, nada é aplicado.
--
-- ATENÇÃO: depois deste arquivo o acesso anônimo (Inspection Mode) deixa de
-- ler/escrever dados. É preciso estar autenticado com profile vinculado.
-- ============================================================================

-- ─── 1. Schema privado de helpers (fora da API exposta) ─────────────────────
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

create or replace function app.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.tenant_id from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function app.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.profile_id = p.id and ur.tenant_id = p.tenant_id
    left join public.roles r on r.id = ur.role_id
    where p.auth_user_id = auth.uid()
      and (
        p.tenant_owner is true
        or lower(coalesce(p.primary_role, '')) in ('admin', 'admin_master', 'administrador')
        or lower(coalesce(r.key, r.label, '')) in ('admin', 'admin_master', 'administrador')
      )
  )
$$;

-- Capacidade access:client-portal (src/data/permissions.ts): Admin, PMO, Project
-- Manager, Product Manager, Product Owner; Scrum Master e Tech Lead são opt-in
-- (mesma lista da Edge Function portal-invite, para a tela e o banco concordarem).
create or replace function app.can_manage_portal()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_tenant_admin() or exists (
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.profile_id = p.id and ur.tenant_id = p.tenant_id
    left join public.roles r on r.id = ur.role_id
    where p.auth_user_id = auth.uid()
      and (
        replace(replace(lower(coalesce(p.primary_role, '')), ' ', '_'), '-', '_') in (
          'pmo', 'project_manager', 'projectmanager', 'pm', 'product_manager', 'productmanager',
          'product_owner', 'productowner', 'po', 'scrum_master', 'scrummaster', 'sm',
          'tech_lead', 'techlead', 'tl')
        or replace(replace(lower(coalesce(r.key, r.label, '')), ' ', '_'), '-', '_') in (
          'pmo', 'project_manager', 'projectmanager', 'pm', 'product_manager', 'productmanager',
          'product_owner', 'productowner', 'po', 'scrum_master', 'scrummaster', 'sm',
          'tech_lead', 'techlead', 'tl')
      )
  )
$$;

revoke all on function app.current_profile_id(), app.current_tenant_id(), app.is_tenant_admin(),
  app.can_manage_portal() from public;
grant execute on function app.current_profile_id(), app.current_tenant_id(), app.is_tenant_admin(),
  app.can_manage_portal() to authenticated, service_role;

-- ─── 2. Limpa TODAS as policies existentes do schema public ─────────────────
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Garante RLS ligado e sem bypass em todas as tabelas do public
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('alter table public.%I force row level security', r.relname);
  end loop;
end $$;

-- Nenhum acesso anônimo ao Data API
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke all on public.%I from anon', r.relname);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.relname);
    execute format('grant all on public.%I to service_role', r.relname);
  end loop;
end $$;

-- ─── 3. Policy genérica por tenant p/ toda tabela com coluna tenant_id ──────
do $$
declare r record;
begin
  for r in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id'
                        and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format($f$
      create policy %I on public.%I
      for all to authenticated
      using (tenant_id = app.current_tenant_id())
      with check (tenant_id = app.current_tenant_id())
    $f$, r.tbl || '_tenant_scope', r.tbl);
  end loop;
end $$;

-- ─── 4. Overrides para tabelas sensíveis ────────────────────────────────────

-- audit_logs: leitura só admin do tenant; insert só do próprio tenant; sem update/delete
drop policy if exists audit_logs_tenant_scope on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (app.is_tenant_admin() or entity_type in ('work_item', 'storage'))
  );
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id());
revoke update, delete on public.audit_logs from authenticated;

-- profiles: leitura no próprio tenant; escrita só self ou admin
drop policy if exists profiles_tenant_scope on public.profiles;
create policy profiles_read_tenant on public.profiles
  for select to authenticated
  using (tenant_id = app.current_tenant_id());
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and (auth_user_id = auth.uid() or app.is_tenant_admin()))
  with check (tenant_id = app.current_tenant_id() and (auth_user_id = auth.uid() or app.is_tenant_admin()));
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id() and app.is_tenant_admin());
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

-- tenants: sem tenant_id — leitura do próprio tenant, update só admin
create policy tenants_read_own on public.tenants
  for select to authenticated
  using (id = app.current_tenant_id());
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (id = app.current_tenant_id() and app.is_tenant_admin())
  with check (id = app.current_tenant_id() and app.is_tenant_admin());

-- Controle de acesso (privilege escalation): leitura escopada, escrita só admin
do $$
declare t text;
begin
  foreach t in array array['user_roles', 'permission_overrides', 'role_permissions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_scope', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (%s)
    $f$, t || '_read', t,
      case when t = 'role_permissions' then 'true' else 'tenant_id = app.current_tenant_id()' end);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (app.is_tenant_admin() and %s)
      with check (app.is_tenant_admin() and %s)
    $f$, t || '_admin_write', t,
      case when t = 'role_permissions' then 'true' else 'tenant_id = app.current_tenant_id()' end,
      case when t = 'role_permissions' then 'true' else 'tenant_id = app.current_tenant_id()' end);
  end loop;
end $$;

-- Catálogos globais e definições: leitura autenticada, escrita só admin
do $$
declare t text;
begin
  foreach t in array array['roles', 'permissions', 'catalogs', 'modules', 'reserved_slugs', 'dashboards'] loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_scope', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (app.is_tenant_admin()) with check (app.is_tenant_admin())
    $f$, t || '_admin_write', t);
  end loop;
end $$;

-- catalog_values: tenant_id pode ser null (valor global) → leitura ampla, escrita admin
drop policy if exists catalog_values_tenant_scope on public.catalog_values;
create policy catalog_values_read on public.catalog_values
  for select to authenticated
  using (tenant_id is null or tenant_id = app.current_tenant_id());
create policy catalog_values_admin_write on public.catalog_values
  for all to authenticated
  using (app.is_tenant_admin() and (tenant_id is null or tenant_id = app.current_tenant_id()))
  with check (app.is_tenant_admin() and (tenant_id is null or tenant_id = app.current_tenant_id()));

-- Convites e eventos de reset: só admin do tenant
do $$
declare t text;
begin
  foreach t in array array['invitations', 'password_reset_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_scope', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (tenant_id = app.current_tenant_id() and app.is_tenant_admin())
      with check (tenant_id = app.current_tenant_id() and app.is_tenant_admin())
    $f$, t || '_admin_only', t);
  end loop;
end $$;

-- Módulos do tenant / pedidos de ativação: leitura no tenant, escrita admin
do $$
declare t text;
begin
  foreach t in array array['tenant_modules', 'module_activation_requests'] loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_scope', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (tenant_id = app.current_tenant_id())
    $f$, t || '_read', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (tenant_id = app.current_tenant_id() and app.is_tenant_admin())
      with check (tenant_id = app.current_tenant_id() and app.is_tenant_admin())
    $f$, t || '_admin_write', t);
  end loop;
end $$;

-- Notificações: qualquer membro do tenant AVISA outro usuário do mesmo tenant;
-- só o dono lê, marca como lida e apaga. (O app gera o id e não pede retorno.)
drop policy if exists notifications_tenant_scope on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and user_id = app.current_profile_id());
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and user_id = app.current_profile_id())
  with check (tenant_id = app.current_tenant_id() and user_id = app.current_profile_id());
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (tenant_id = app.current_tenant_id() and user_id = app.current_profile_id());
create policy notifications_insert_tenant on public.notifications
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and exists (
      select 1 from public.profiles p
      where p.id = notifications.user_id and p.tenant_id = app.current_tenant_id()
    )
  );

-- Timesheets: dono, aprovador ou admin
drop policy if exists timesheets_tenant_scope on public.timesheets;
create policy timesheets_scope on public.timesheets
  for all to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (user_id = app.current_profile_id() or approver_id = app.current_profile_id() or app.is_tenant_admin())
  )
  with check (
    tenant_id = app.current_tenant_id()
    and (user_id = app.current_profile_id() or approver_id = app.current_profile_id() or app.is_tenant_admin())
  );

drop policy if exists timesheet_approvals_tenant_scope on public.timesheet_approvals;
create policy timesheet_approvals_scope on public.timesheet_approvals
  for all to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (
      approver_id = app.current_profile_id()
      or app.is_tenant_admin()
      or exists (
        select 1 from public.timesheets t
        where t.id = timesheet_id and t.tenant_id = timesheet_approvals.tenant_id
          and t.user_id = app.current_profile_id()
      )
    )
  )
  with check (
    tenant_id = app.current_tenant_id()
    and (approver_id = app.current_profile_id() or app.is_tenant_admin())
  );

-- Portal do cliente: contas do portal escritas por quem tem access:client-portal
-- (Admin, PMO, Project/Product Manager, PO); leitura no tenant. Cliente logado no
-- portal NÃO tem profile: não passa por aqui, só pelas funções portal_*.
drop policy if exists client_portal_users_tenant_scope on public.client_portal_users;
create policy client_portal_users_read on public.client_portal_users
  for select to authenticated
  using (tenant_id = app.current_tenant_id());
create policy client_portal_users_manage_write on public.client_portal_users
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.can_manage_portal())
  with check (tenant_id = app.current_tenant_id() and app.can_manage_portal());

-- activation_tokens: nunca acessível anonimamente; só admin do tenant e o
-- service_role. O hash do token deixa de ser legível pela API (column grant).
drop policy if exists activation_tokens_tenant_scope on public.activation_tokens;
revoke all on public.activation_tokens from anon, authenticated;
grant select (id, tenant_id, profile_id, purpose, expires_at, used_at, created_at, created_by, metadata)
  on public.activation_tokens to authenticated;
grant insert, update, delete on public.activation_tokens to authenticated;
grant all on public.activation_tokens to service_role;
create policy activation_tokens_admin_only on public.activation_tokens
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_tenant_admin())
  with check (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

-- ─── 5. Funções SECURITY DEFINER expostas no schema public ──────────────────
-- check_slug: lógica movida para o schema privado; wrapper público é INVOKER.
create or replace function app.check_slug(p_slug text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_slug text;
begin
  v_slug := public.normalize_slug(p_slug);
  if v_slug is null or length(v_slug) < 3 or length(v_slug) > 63 then
    return 'invalid';
  end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
    return 'invalid';
  end if;
  if exists (select 1 from public.reserved_slugs r where r.slug = v_slug) then
    return 'reserved';
  end if;
  if exists (select 1 from public.tenants t where lower(t.slug) = v_slug) then
    return 'unavailable';
  end if;
  return 'available';
end;
$function$;

revoke all on function app.check_slug(text) from public;
grant execute on function app.check_slug(text) to authenticated, service_role;

create or replace function public.check_slug(p_slug text)
returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select app.check_slug(p_slug)
$$;

revoke all on function public.check_slug(text) from public, anon;
grant execute on function public.check_slug(text) to authenticated, service_role;

-- ensure_fk é helper de DDL — não deve ser chamável pela API (se existir)
do $$
begin
  if to_regprocedure('public.ensure_fk(text, text, text[], text, text[], text)') is not null then
    revoke all on function public.ensure_fk(text, text, text[], text, text[], text) from public, anon, authenticated;
  end if;
end $$;

-- ─── 6. search_path imutável nas funções restantes ──────────────────────────
create or replace function public.tg_touch_row()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  new.updated_at  := now();
  new.row_version := coalesce(old.row_version, 0) + 1;
  return new;
end;
$function$;

-- Garante search_path em qualquer outra função public que ainda não tenha
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'
      ))
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- Trigger functions não precisam ser chamáveis via API
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.prokind = 't' or p.prorettype = 'trigger'::regtype)
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- ─── 7. Nenhuma função SECURITY DEFINER exposta na API ──────────────────────
-- Toda função SECURITY DEFINER que sobrou em `public` deixa de ser executável
-- por anon/authenticated; a lógica privilegiada vive no schema `app`, e o
-- wrapper público public.check_slug é SECURITY INVOKER.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Helpers de DDL nunca devem ser chamáveis pela API
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('ensure_fk', '__act_add_tenant_fk')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- ─── 8. Views: respeitam o RLS de quem consulta ─────────────────────────────
-- Sem isto uma view roda com os privilégios do dono e ignora o RLS das tabelas
-- (v_tenant_storage / v_project_storage hoje são legíveis por qualquer pessoa).
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = true)', r.relname);
    execute format('revoke all on public.%I from anon', r.relname);
    execute format('grant select on public.%I to authenticated, service_role', r.relname);
  end loop;
end $$;

-- app_user_connections (chaves de conexão criptografadas) não tem tenant_id e NÃO
-- recebe policy de propósito: negada a authenticated; só as Edge Functions
-- (service_role) acessam.

-- Sem execução de funções novas por anon por padrão
alter default privileges in schema public revoke execute on functions from anon;
revoke usage on schema public from anon;

notify pgrst, 'reload schema';
