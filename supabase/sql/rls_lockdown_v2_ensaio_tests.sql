-- ============================================================================
-- ENSAIO do RLS lockdown v2 — testes que rodam DEPOIS do corpo do v2, na MESMA
-- consulta. Cole assim, numa única query do SQL Editor:
--
--     1) o conteúdo INTEIRO de rls_lockdown_v2.sql
--     2) logo abaixo, este arquivo (rls_lockdown_v2_ensaio_tests.sql)
--
-- O ensaio simula anon, admin, membro comum, cliente do portal e desconhecido
-- e termina SEMPRE com um erro proposital "ENSAIO CONCLUÍDO" cujo texto é o
-- relatório. Esse erro desfaz a transação inteira: NADA é aplicado ao banco.
-- Não use begin/commit/rollback — o próprio erro faz o papel do rollback.
-- ============================================================================

create temp table _ensaio (ord int, teste text, esperado text, obtido text, ok boolean);

create or replace function pg_temp.rec(p_ord int, p_teste text, p_esp text, p_obt text, p_ok boolean)
returns void language plpgsql as $$
begin
  insert into _ensaio values (p_ord, p_teste, p_esp, p_obt, coalesce(p_ok, false));
end $$;

-- simula um usuário logado (vale só nesta transação)
create or replace function pg_temp.sim(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end $$;

-- ─── 1. Visitante SEM login (chave pública) não lê nada ──────────────────────
do $$
declare
  t     text;
  v_n   bigint;
  v_obt text;
  v_ord int := 100;
begin
  foreach t in array array['profiles', 'tenants', 'work_items', 'audit_logs', 'client_portal_users',
                           'activation_tokens', 'timesheets', 'v_tenant_storage'] loop
    v_ord := v_ord + 1;
    begin
      set local role anon;
      execute format('select count(*) from public.%I', t) into v_n;
      v_obt := 'LEU ' || v_n || ' linhas';
    exception
      when insufficient_privilege then v_obt := 'bloqueado';
      when others then v_obt := 'erro: ' || sqlerrm;
    end;
    reset role;
    perform pg_temp.rec(v_ord, 'visitante lê ' || t, 'bloqueado', v_obt, v_obt = 'bloqueado');
  end loop;

  -- visitante também não chama as funções do portal
  begin
    set local role anon;
    perform public.portal_context();
    v_obt := 'EXECUTOU';
  exception
    when insufficient_privilege then v_obt := 'bloqueado';
    when others then v_obt := 'erro: ' || sqlerrm;
  end;
  reset role;
  perform pg_temp.rec(110, 'visitante chama portal_context()', 'bloqueado', v_obt, v_obt = 'bloqueado');
end $$;

-- ─── 2. Admin do tenant: vê o próprio tenant e nada de outro ─────────────────
do $$
declare
  v_uid uuid; v_tid uuid;
  v_prof bigint; v_prof_out bigint; v_ten bigint; v_audit bigint;
  v_work_out bigint; v_view_out bigint;
begin
  select p.auth_user_id, p.tenant_id into v_uid, v_tid
    from public.profiles p
   where p.auth_user_id is not null and p.archived_at is null
     and (p.tenant_owner or lower(coalesce(p.primary_role, '')) in ('admin', 'admin_master', 'administrador'))
   order by p.created_at limit 1;

  if v_uid is null then
    perform pg_temp.rec(200, 'admin: achar um admin vinculado', 'existir',
                        'nenhum admin vinculado — rode rls_prep_link_profiles.sql', false);
    return;
  end if;

  perform pg_temp.sim(v_uid);
  set local role authenticated;
  select count(*) into v_prof from public.profiles;
  execute format('select count(*) from public.profiles where tenant_id <> %L', v_tid) into v_prof_out;
  select count(*) into v_ten from public.tenants;
  select count(*) into v_audit from public.audit_logs;
  execute format('select count(*) from public.work_items where tenant_id <> %L', v_tid) into v_work_out;
  execute format('select count(*) from public.v_tenant_storage where tenant_id <> %L', v_tid) into v_view_out;
  reset role;

  perform pg_temp.rec(201, 'admin: perfis do próprio tenant', 'mais de 0', v_prof::text, v_prof > 0);
  perform pg_temp.rec(202, 'admin: perfis de OUTROS tenants', '0', v_prof_out::text, v_prof_out = 0);
  perform pg_temp.rec(203, 'admin: tenants visíveis', '1', v_ten::text, v_ten = 1);
  perform pg_temp.rec(204, 'admin: lê audit_logs', 'mais de 0', v_audit::text, v_audit > 0);
  perform pg_temp.rec(205, 'admin: itens de OUTROS tenants', '0', v_work_out::text, v_work_out = 0);
  perform pg_temp.rec(206, 'admin: view de armazenamento de OUTROS tenants', '0', v_view_out::text, v_view_out = 0);
end $$;

-- ─── 3. Membro comum: audit_logs só de tipos não sensíveis; avisa outro usuário ─
do $$
declare
  v_uid uuid; v_tid uuid; v_me uuid; v_other uuid;
  v_bad bigint; v_ins text; v_read bigint;
begin
  select p.auth_user_id, p.tenant_id, p.id into v_uid, v_tid, v_me
    from public.profiles p
   where p.auth_user_id is not null and p.archived_at is null
     and not coalesce(p.tenant_owner, false)
     and lower(coalesce(p.primary_role, '')) not in ('admin', 'admin_master', 'administrador')
   order by p.created_at limit 1;

  if v_uid is null then
    perform pg_temp.rec(300, 'membro comum: achar um vinculado', 'existir', 'nenhum — teste pulado', true);
    return;
  end if;

  select p.id into v_other from public.profiles p
   where p.tenant_id = v_tid and p.id <> v_me and p.archived_at is null limit 1;

  perform pg_temp.sim(v_uid);
  set local role authenticated;
  select count(*) into v_bad from public.audit_logs where entity_type not in ('work_item', 'storage');
  begin
    insert into public.notifications (id, tenant_id, user_id, type, title)
    values (gen_random_uuid(), v_tid, v_other, 'info', 'ensaio-notificacao');
    v_ins := 'gravou';
  exception when others then
    v_ins := 'erro: ' || sqlerrm;
  end;
  select count(*) into v_read from public.notifications where title = 'ensaio-notificacao';
  reset role;

  perform pg_temp.rec(301, 'membro: lê audit_logs de tipo sensível', '0', v_bad::text, v_bad = 0);
  perform pg_temp.rec(302, 'membro: avisa OUTRO usuário (notificação)', 'gravou', v_ins, v_ins = 'gravou');
  perform pg_temp.rec(303, 'membro: lê a notificação que mandou a outro', '0', v_read::text, v_read = 0);
end $$;

-- ─── 4. Cliente do portal (sem profile): só pelas funções portal_* ───────────
do $$
declare
  v_uid constant uuid := '00000000-0000-0000-0000-0000000000aa';
  v_row uuid; v_n int;
  v_ctx jsonb; v_proj bigint; v_prof bigint; v_work bigint;
  v_pid uuid; v_msg text;
begin
  select u.id into v_row
    from public.client_portal_users u
   where u.archived_at is null and u.status in ('invited', 'pending', 'active') and u.can_comment
   order by u.created_at limit 1;
  if v_row is not null then
    update public.client_portal_users set auth_user_id = v_uid where id = v_row;
    get diagnostics v_n = row_count;
  else
    v_n := 0;
  end if;

  if v_n = 0 then
    perform pg_temp.rec(400, 'cliente: preparar acesso de teste', '1 linha', 'nenhum acesso de portal atualizável', false);
    return;
  end if;

  perform pg_temp.sim(v_uid);
  set local role authenticated;
  v_ctx := public.portal_context();
  select count(*) into v_proj from public.projects;
  select count(*) into v_prof from public.profiles;
  select count(*) into v_work from public.work_items;
  if v_ctx is not null then
    v_pid := (v_ctx -> 'projectIds' ->> 0)::uuid;
    begin
      v_msg := (public.portal_add_message(v_pid, 'mensagem de ensaio (desfeita)') ->> 'id');
    exception when others then
      v_msg := 'erro: ' || sqlerrm;
    end;
  end if;
  reset role;

  perform pg_temp.rec(401, 'cliente: portal_context() funciona', 'não nulo', coalesce(left(v_ctx::text, 40), 'NULO'), v_ctx is not null);
  perform pg_temp.rec(402, 'cliente: lê projects direto', '0', v_proj::text, v_proj = 0);
  perform pg_temp.rec(403, 'cliente: lê profiles direto', '0', v_prof::text, v_prof = 0);
  perform pg_temp.rec(404, 'cliente: lê work_items direto', '0', v_work::text, v_work = 0);
  perform pg_temp.rec(405, 'cliente: envia mensagem pela função', 'id gerado', coalesce(v_msg, 'sem retorno'),
                      v_msg is not null and v_msg not like 'erro:%');
end $$;

-- ─── 5. Usuário logado SEM nenhum acesso (desconhecido) ──────────────────────
do $$
declare
  v_ctx jsonb; v_proj bigint; v_prof bigint;
begin
  perform pg_temp.sim('00000000-0000-0000-0000-000000000099');
  set local role authenticated;
  v_ctx := public.portal_context();
  select count(*) into v_proj from public.projects;
  select count(*) into v_prof from public.profiles;
  reset role;
  perform pg_temp.rec(501, 'desconhecido: portal_context()', 'nulo', coalesce(left(v_ctx::text, 40), 'NULO'), v_ctx is null);
  perform pg_temp.rec(502, 'desconhecido: lê projects', '0', v_proj::text, v_proj = 0);
  perform pg_temp.rec(503, 'desconhecido: lê profiles', '0', v_prof::text, v_prof = 0);
end $$;

-- ─── 6. link_my_profile(): 1º login de perfil sem vínculo ────────────────────
do $$
declare
  v_pid uuid; v_uid uuid; v_ret uuid; v_after uuid;
begin
  select p.id, p.auth_user_id into v_pid, v_uid
    from public.profiles p
    join auth.users u on u.id = p.auth_user_id
   where p.archived_at is null
     and u.email_confirmed_at is not null
     and lower(btrim(u.email)) = lower(btrim(p.email))
     and (select count(*) from public.profiles q
           where lower(btrim(q.email)) = lower(btrim(p.email)) and q.archived_at is null) = 1
   limit 1;

  if v_pid is null then
    perform pg_temp.rec(600, 'link_my_profile: achar candidato', 'existir', 'nenhum candidato — teste pulado', true);
    return;
  end if;

  update public.profiles set auth_user_id = null where id = v_pid;
  perform pg_temp.sim(v_uid);
  set local role authenticated;
  v_ret := public.link_my_profile();
  reset role;
  select auth_user_id into v_after from public.profiles where id = v_pid;

  perform pg_temp.rec(601, 'link_my_profile: devolve o perfil', 'o próprio perfil', coalesce(v_ret::text, 'NULO'), v_ret = v_pid);
  perform pg_temp.rec(602, 'link_my_profile: grava o vínculo', 'auth_user_id restaurado', coalesce(v_after::text, 'NULO'), v_after = v_uid);
end $$;

-- ─── 7. Estrutura do banco depois do lockdown ────────────────────────────────
do $$
declare
  v_noforce bigint; v_anon bigint; v_nopol text; v_bypass boolean;
begin
  select count(*) into v_noforce
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity;

  select count(*) into v_anon
    from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public';

  select coalesce(string_agg(c.relname, ', ' order by c.relname), '(nenhuma)') into v_nopol
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);

  select r.rolbypassrls into v_bypass
    from pg_proc p join pg_roles r on r.oid = p.proowner
   where p.pronamespace = 'app'::regnamespace and p.proname = 'portal_context' limit 1;

  perform pg_temp.rec(701, 'tabelas SEM FORCE RLS', '0', v_noforce::text, v_noforce = 0);
  perform pg_temp.rec(702, 'permissões restantes do anon em public', '0', v_anon::text, v_anon = 0);
  perform pg_temp.rec(703, 'tabelas sem nenhuma policy', 'só app_user_connections', v_nopol, v_nopol = 'app_user_connections');
  perform pg_temp.rec(704, 'dono das funções do portal ignora RLS', 'true', coalesce(v_bypass::text, 'NULO'), coalesce(v_bypass, false));
end $$;

-- ─── RELATÓRIO + desfaz tudo (erro proposital) ───────────────────────────────
do $$
declare
  v_rel text; v_falhas int;
begin
  select count(*) filter (where not ok) into v_falhas from _ensaio;
  select string_agg(
           format('%s %s | %s | esperado: %s | obtido: %s',
                  case when ok then '[OK]    ' else '[FALHOU]' end, ord, teste, esperado, obtido),
           E'\n' order by ord)
    into v_rel from _ensaio;
  raise exception E'ENSAIO CONCLUÍDO — NADA FOI APLICADO (este erro é proposital e desfaz tudo).\nFalhas: %\n\n%',
    v_falhas, v_rel;
end $$;
