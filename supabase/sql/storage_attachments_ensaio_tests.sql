-- ============================================================================
-- ENSAIO do storage_attachments_lockdown_v2.sql — cole numa ÚNICA query:
--   1) PRIMEIRO o conteúdo INTEIRO de storage_attachments_lockdown_v2.sql
--   2) DEPOIS, logo abaixo, este arquivo
-- Termina SEMPRE com o erro proposital "ENSAIO CONCLUÍDO" (desfaz tudo; nada é
-- aplicado). Não use begin/commit/rollback.
-- ============================================================================

create temp table _ens (ord int, teste text, esperado text, obtido text, ok boolean);

create or replace function pg_temp.sim(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end $$;

do $$
declare
  v_total bigint; v_anon text; v_n bigint;
  v_adm uuid; v_tid uuid; v_adm_ok bigint; v_adm_fora bigint;
  v_o_uid uuid; v_o_tid uuid; v_o_vis bigint;
  v_pub boolean; v_polanon bigint;
begin
  select count(*) into v_total from storage.objects where bucket_id = 'attachments';

  -- visitante sem login: nenhum objeto
  begin
    set local role anon;
    select count(*) into v_n from storage.objects where bucket_id = 'attachments';
    v_anon := v_n::text;
  exception when insufficient_privilege then
    v_anon := '0';
  end;
  reset role;
  insert into _ens values (1, 'visitante lista objetos do bucket', '0', v_anon, v_anon = '0');

  -- admin do tenant: vê só os objetos do próprio tenant
  select p.auth_user_id, p.tenant_id into v_adm, v_tid
    from public.profiles p
   where p.auth_user_id is not null and p.archived_at is null
     and (p.tenant_owner or lower(coalesce(p.primary_role, '')) in ('admin', 'admin_master', 'administrador'))
   order by p.created_at limit 1;
  if v_adm is not null then
    perform pg_temp.sim(v_adm);
    set local role authenticated;
    select count(*) into v_adm_ok from storage.objects where bucket_id = 'attachments';
    execute format($f$select count(*) from storage.objects
                      where bucket_id = 'attachments' and (storage.foldername(name))[1] <> %L$f$, v_tid::text)
      into v_adm_fora;
    reset role;
    insert into _ens values (2, 'admin vê objetos do próprio tenant', 'tantos quantos existem do tenant dele (total no bucket: ' || v_total || ')',
                             v_adm_ok::text, v_adm_ok > 0 or v_total = 0);
    insert into _ens values (3, 'admin vê objetos de OUTROS tenants', '0', v_adm_fora::text, v_adm_fora = 0);
  else
    insert into _ens values (2, 'admin: achar um admin vinculado', 'existir', 'nenhum', false);
  end if;

  -- usuário de OUTRO tenant não vê os anexos do tenant #1
  select p.auth_user_id, p.tenant_id into v_o_uid, v_o_tid
    from public.profiles p
   where p.auth_user_id is not null and p.archived_at is null
     and p.tenant_id <> coalesce(v_tid, '00000000-0000-0000-0000-000000000000'::uuid)
   order by p.created_at limit 1;
  if v_o_uid is not null then
    perform pg_temp.sim(v_o_uid);
    set local role authenticated;
    select count(*) into v_o_vis from storage.objects
     where bucket_id = 'attachments' and (storage.foldername(name))[1] = v_tid::text;
    reset role;
    insert into _ens values (4, 'usuário de OUTRO tenant vê anexos do tenant #1', '0', v_o_vis::text, v_o_vis = 0);
  else
    insert into _ens values (4, 'outro tenant: achar usuário vinculado', 'existir', 'nenhum — teste pulado', true);
  end if;

  -- estrutura
  select b.public into v_pub from storage.buckets b where b.id = 'attachments';
  select count(*) into v_polanon from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and ('anon' = any (roles) or 'public' = any (roles))
     and coalesce(qual, '') || coalesce(with_check, '') like '%attachments%';
  insert into _ens values (5, 'bucket attachments é público', 'false', coalesce(v_pub::text, 'sem bucket'), coalesce(v_pub, true) = false);
  insert into _ens values (6, 'policies de anon/public que citam o bucket', '0', v_polanon::text, v_polanon = 0);
end $$;

do $$
declare
  v_rel text; v_falhas int;
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
