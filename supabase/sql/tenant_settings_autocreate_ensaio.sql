-- ============================================================================
-- ENSAIO do tenant_settings_autocreate.sql — cole numa ÚNICA query, nesta ordem:
--   1) o conteúdo INTEIRO de tenant_settings_autocreate.sql
--   2) logo abaixo, este arquivo
-- Termina SEMPRE com o erro proposital "ENSAIO CONCLUÍDO" (desfaz tudo; nada é
-- aplicado). Não use begin/commit/rollback.
-- ============================================================================

create temp table _ens (ord int, teste text, esperado text, obtido text, ok boolean);

do $$
declare
  v_sem int; v_novo uuid; v_plano text; v_quota bigint; v_status text; v_n int;
begin
  -- 1) depois do backfill, nenhum tenant fica sem linha de settings
  select count(*) into v_sem from public.tenants t
   where not exists (select 1 from public.tenant_settings s where s.tenant_id = t.id);
  insert into _ens values (1, 'tenants sem tenant_settings (backfill)', '0', v_sem::text, v_sem = 0);

  -- 2) tenant novo ganha a linha sozinho, com a cota Free
  begin
    insert into public.tenants (name, slug)
    values ('ensaio tmp', 'ensaio-' || substr(md5(random()::text), 1, 8))
    returning id into v_novo;
    select storage_plan, storage_quota_bytes, admin_master_status
      into v_plano, v_quota, v_status
      from public.tenant_settings where tenant_id = v_novo;
    insert into _ens values (2, 'tenant novo: linha criada pelo trigger', 'existir', coalesce(v_plano, 'SEM LINHA'), v_plano is not null);
    insert into _ens values (3, 'tenant novo: cota de armazenamento', '> 0 (Free = 1 GB = 1073741824)', coalesce(v_quota::text, 'null'), coalesce(v_quota, 0) > 0);
    insert into _ens values (4, 'tenant novo: admin_master_status', 'defined (não reabre a eleição)', coalesce(v_status, 'null'), v_status = 'defined');
  exception when others then
    insert into _ens values (2, 'tenant novo: inserir tenant de teste', 'ok', 'erro: ' || sqlerrm, false);
  end;

  -- 3) função do trigger não é executável por visitante/logado
  select count(*) into v_n
    from information_schema.routine_privileges
   where routine_schema = 'app' and routine_name = 'tg_tenants_create_settings'
     and grantee in ('PUBLIC', 'anon', 'authenticated');
  insert into _ens values (5, 'função do trigger exposta a anon/authenticated', '0', v_n::text, v_n = 0);
end $$;

do $$
declare v_rel text; v_falhas int;
begin
  select count(*) filter (where not ok) into v_falhas from _ens;
  select string_agg(
           format('%s %s | %s | esperado: %s | obtido: %s',
                  case when ok then '[OK]    ' else '[FALHOU]' end, ord, teste, esperado, obtido),
           E'\n' order by ord)
    into v_rel from _ens;
  raise exception E'ENSAIO CONCLUÍDO — NADA FOI APLICADO (este erro é proposital e desfaz tudo).\nFalhas: %\n\n%',
    v_falhas, v_rel;
end $$;
