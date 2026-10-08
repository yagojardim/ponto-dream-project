-- ============================================================================
-- ENSAIO (parte dos MEMBROS) — cobre as regras de membro comum e a capacidade do
-- portal, que o 1º ensaio pulou por não haver membro comum vinculado.
--
-- ORDEM OBRIGATÓRIA, numa única query do SQL Editor:
--   1) PRIMEIRO o conteúdo INTEIRO de rls_lockdown_v2.sql
--   2) DEPOIS, logo abaixo, este arquivo
-- (se os testes vierem antes, o lockdown não é aplicado antes de testar)
-- Termina SEMPRE com o erro proposital "ENSAIO CONCLUÍDO" (desfaz tudo; nada é
-- aplicado). Não use begin/commit/rollback.
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

-- ─── 3. Membro comum: audit_logs só de tipos não sensíveis; avisa outro usuário ─
-- profiles.auth_user_id tem FK para auth.users: não dá para usar um UUID inventado.
-- O ensaio usa um usuário REAL do Auth que ainda não está ligado a nenhum perfil e
-- liga/desliga os perfis de teste um de cada vez (tudo desfeito no final).
do $$
declare
  v_free uuid; v_uid uuid; v_tid uuid; v_me uuid; v_other uuid; v_origem text; v_ligou boolean := false;
  v_bad bigint; v_vis text; v_ins text; v_read bigint; v_upd int; v_prof bigint;
begin
  select u.id into v_free
    from auth.users u
   where not exists (select 1 from public.profiles p where p.auth_user_id = u.id)
   order by u.created_at limit 1;

  select p.auth_user_id, p.tenant_id, p.id into v_uid, v_tid, v_me
    from public.profiles p
   where p.auth_user_id is not null and p.archived_at is null
     and not coalesce(p.tenant_owner, false)
     and lower(coalesce(p.primary_role, '')) not in ('admin', 'admin_master', 'administrador')
   order by p.created_at limit 1;
  v_origem := 'membro real vinculado';

  if v_uid is null then
    select p.tenant_id, p.id into v_tid, v_me
      from public.profiles p
     where p.auth_user_id is null and p.archived_at is null
       and not coalesce(p.tenant_owner, false)
       and lower(coalesce(p.primary_role, '')) not in ('admin', 'admin_master', 'administrador')
     order by p.created_at limit 1;
    if v_me is null then
      perform pg_temp.rec(300, 'membro comum: achar um perfil comum', 'existir', 'nenhum perfil comum no banco', false);
      return;
    end if;
    if v_free is null then
      perform pg_temp.rec(300, 'membro comum: achar um usuário livre no Auth', 'existir', 'nenhum usuário do Auth sem perfil', false);
      return;
    end if;
    v_uid := v_free;
    update public.profiles set auth_user_id = v_uid where id = v_me;
    v_ligou := true;
    v_origem := 'perfil comum ligado a um usuário livre do Auth (só no ensaio)';
  end if;
  perform pg_temp.rec(300, 'membro comum: perfil usado no teste', 'existir', v_origem, true);

  select p.id into v_other from public.profiles p
   where p.tenant_id = v_tid and p.id <> v_me and p.archived_at is null limit 1;

  perform pg_temp.sim(v_uid);
  set local role authenticated;
  select count(*) into v_prof from public.profiles;
  select count(*) into v_bad from public.audit_logs where entity_type not in ('work_item', 'storage');
  select coalesce(string_agg(distinct entity_type, ','), '(nenhum)') into v_vis from public.audit_logs;
  begin
    insert into public.notifications (id, tenant_id, user_id, type, title)
    values (gen_random_uuid(), v_tid, v_other, 'info', 'ensaio-notificacao');
    v_ins := 'gravou';
  exception when others then
    v_ins := 'erro: ' || sqlerrm;
  end;
  select count(*) into v_read from public.notifications where title = 'ensaio-notificacao';
  -- membro NÃO altera o perfil de outra pessoa
  update public.profiles set job_title = job_title where id = v_other;
  get diagnostics v_upd = row_count;
  reset role;

  if v_ligou then
    update public.profiles set auth_user_id = null where id = v_me;
  end if;

  perform pg_temp.rec(301, 'membro: lê perfis do próprio tenant', 'mais de 0', v_prof::text, v_prof > 0);
  perform pg_temp.rec(302, 'membro: lê audit_logs de tipo sensível', '0', v_bad::text, v_bad = 0);
  perform pg_temp.rec(303, 'membro: tipos de audit_logs que enxerga', 'só work_item/storage', v_vis,
                      v_vis in ('(nenhum)', 'work_item', 'storage', 'storage,work_item'));
  perform pg_temp.rec(304, 'membro: avisa OUTRO usuário (notificação)', 'gravou', v_ins, v_ins = 'gravou');
  perform pg_temp.rec(305, 'membro: lê a notificação que mandou a outro', '0', v_read::text, v_read = 0);
  perform pg_temp.rec(306, 'membro: altera o perfil de OUTRA pessoa', '0 linhas', v_upd::text, v_upd = 0);
end $$;

-- ─── 3b. Capacidade do portal: PO gerencia os acessos; Dev não ───────────────
do $$
declare
  v_free uuid; v_po uuid; v_dev uuid; v_tid uuid; v_n_po int; v_n_dev int;
begin
  select u.id into v_free
    from auth.users u
   where not exists (select 1 from public.profiles p where p.auth_user_id = u.id)
   order by u.created_at limit 1;

  select p.id, p.tenant_id into v_po, v_tid
    from public.profiles p
   where p.archived_at is null
     and replace(lower(coalesce(p.primary_role, '')), '_', '') in ('productowner', 'po')
   order by p.created_at limit 1;
  select p.id into v_dev
    from public.profiles p
   where p.archived_at is null and p.tenant_id = v_tid
     and replace(lower(coalesce(p.primary_role, '')), '_', '') in ('dev', 'developer')
   order by p.created_at limit 1;

  if v_po is null or v_dev is null then
    perform pg_temp.rec(310, 'portal: achar um PO e um Dev no mesmo tenant', 'existir', 'não achou — teste pulado', true);
    return;
  end if;
  if v_free is null then
    perform pg_temp.rec(310, 'portal: achar um usuário livre no Auth', 'existir', 'nenhum usuário do Auth sem perfil', false);
    return;
  end if;

  -- PO: liga ao usuário livre, testa, desliga
  update public.profiles set auth_user_id = v_free where id = v_po;
  perform pg_temp.sim(v_free);
  set local role authenticated;
  update public.client_portal_users set name = name where tenant_id = v_tid;
  get diagnostics v_n_po = row_count;
  reset role;
  update public.profiles set auth_user_id = null where id = v_po;

  -- Dev: liga ao MESMO usuário livre, testa, desliga
  update public.profiles set auth_user_id = v_free where id = v_dev;
  perform pg_temp.sim(v_free);
  set local role authenticated;
  update public.client_portal_users set name = name where tenant_id = v_tid;
  get diagnostics v_n_dev = row_count;
  reset role;
  update public.profiles set auth_user_id = null where id = v_dev;

  perform pg_temp.rec(311, 'portal: PO altera acessos do portal', 'mais de 0 linhas', v_n_po::text, v_n_po > 0);
  perform pg_temp.rec(312, 'portal: Dev altera acessos do portal', '0 linhas', v_n_dev::text, v_n_dev = 0);
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
