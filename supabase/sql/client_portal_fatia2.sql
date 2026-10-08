-- ============================================================================
-- Portal do Cliente — Fatia 2: leitura/gravação por funções seguras.
--
-- O portal deixa de ler tabelas internas direto do navegador. Passa a chamar
-- funções que identificam o cliente pelo LOGIN (auth.uid() -> client_portal_users
-- .auth_user_id) e devolvem só o que o cliente pode ver. Nada vem do navegador
-- como identidade: autor e título do item são resolvidos no servidor.
--
-- Também cria epics.client_visible (chave "visível ao cliente" por épico) e só
-- libera o portal para tenants com o módulo CLIENT_PORTAL ativo.
--
-- Pré-requisito: client_portal_auth.sql (coluna auth_user_id) já aplicado.
-- Idempotente: pode ser reexecutado. Seguir o molde do repositório
-- (security_definer_hardening.sql): lógica privilegiada em `app`, wrappers
-- SECURITY INVOKER em `public`.
-- ============================================================================

-- ─── 1. Épico: chave "visível ao cliente" (padrão: NÃO visível) ──────────────
alter table public.epics
  add column if not exists client_visible boolean not null default false;

comment on column public.epics.client_visible is
  'true = o épico aparece no Roadmap do Portal do Cliente (decisão de quem gerencia o projeto). Só tem efeito com o módulo CLIENT_PORTAL ativo.';

-- ─── 2. Schema privado ───────────────────────────────────────────────────────
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- ─── 3. Helpers privados ─────────────────────────────────────────────────────

-- Módulo CLIENT_PORTAL ativo para o tenant? Mesma regra do app (modules.ts):
-- status do tenant (tenant_modules) ou, sem linha, o default do catálogo;
-- ativo = operational / implemented / preview (e aliases em PT).
create or replace function app.portal_module_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select lower(btrim(coalesce(
             (select tm.status
                from public.tenant_modules tm
               where tm.tenant_id = p_tenant_id
                 and tm.module_id = m.id
                 and tm.archived_at is null
               limit 1),
             m.default_status)))
           in ('operational', 'operacional', 'implemented', 'implementado', 'preview')
      from public.modules m
     where m.key = 'CLIENT_PORTAL'
       and m.archived_at is null
     limit 1
  ), false)
$$;

-- Acessos de portal do usuário logado (um tenant só; módulo ativo; não bloqueado).
create or replace function app.portal_rows()
returns setof public.client_portal_users
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mine as (
    select u.*
      from public.client_portal_users u
     where auth.uid() is not null
       and u.auth_user_id = auth.uid()
       and u.archived_at is null
       and u.status in ('invited', 'pending', 'active')
  ), t as (
    select tenant_id from mine order by created_at, id limit 1
  )
  select m.*
    from mine m
    join t on t.tenant_id = m.tenant_id
   where app.portal_module_active(m.tenant_id)
$$;

-- Item de trabalho liberado ao cliente? (shared_project_items != internal OU
-- visibility client_visible/shared) — mesma regra que o portal usava no navegador.
create or replace function app.portal_item_visible(p_tenant_id uuid, p_project_id uuid, p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.work_items w
     where w.id = p_item_id
       and w.tenant_id = p_tenant_id
       and w.project_id = p_project_id
       and w.archived_at is null
       and (
         lower(coalesce(w.visibility, '')) in ('client_visible', 'shared')
         or exists (
           select 1
             from public.shared_project_items s
            where s.tenant_id = w.tenant_id
              and s.project_id = w.project_id
              and s.shared_entity_type = 'work_item'
              and s.shared_entity_id = w.id
              and s.archived_at is null
              and s.visibility <> 'internal'
         )
       )
  )
$$;

-- ─── 4. Funções do portal (lógica privilegiada) ──────────────────────────────

-- Contexto do cliente logado (null se não há acesso).
create or replace function app.portal_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'id',                 (array_agg(r.id order by r.created_at, r.id))[1],
           'name',               (array_agg(r.name order by r.created_at, r.id))[1],
           'email',              (array_agg(r.email order by r.created_at, r.id))[1],
           'tenantId',           (array_agg(r.tenant_id order by r.created_at, r.id))[1],
           'portalRole',         case when bool_or(r.portal_role = 'portal-admin') then 'portal-admin' else 'viewer' end,
           'canApprove',         bool_or(r.can_approve),
           'canPreview',         bool_or(r.can_preview),
           'canComment',         bool_or(r.can_comment),
           'passwordMustChange', bool_or(r.password_must_change),
           'projectIds',         to_jsonb(array_agg(distinct r.project_id)),
           'userIds',            to_jsonb(array_agg(r.id))
         )
    into v
    from app.portal_rows() r
  having count(*) > 0;
  return v;
end;
$$;

-- Escopo de UM projeto: projeto, sprints, entregas liberadas e roadmap
-- (somente épicos com client_visible = true; contagens só de itens liberados).
create or replace function app.portal_project_scope(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tid        uuid;
  v_project    jsonb;
  v_sprints    jsonb;
  v_deliveries jsonb;
  v_roadmap    jsonb;
begin
  select r.tenant_id into v_tid from app.portal_rows() r where r.project_id = p_project_id limit 1;
  if v_tid is null then
    return null;
  end if;

  select jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status,
                            'period_start', p.period_start, 'period_end', p.period_end)
    into v_project
    from public.projects p
   where p.id = p_project_id and p.tenant_id = v_tid and p.archived_at is null;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'state', s.state,
                                               'start_date', s.start_date, 'end_date', s.end_date)
                            order by s.start_date nulls last), '[]'::jsonb)
    into v_sprints
    from public.sprints s
   where s.project_id = p_project_id and s.tenant_id = v_tid and s.archived_at is null;

  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'status', w.status,
                                               'due_date', w.due_date, 'completed_at', w.completed_at)
                            order by w.created_at), '[]'::jsonb)
    into v_deliveries
    from public.work_items w
   where w.project_id = p_project_id
     and w.tenant_id = v_tid
     and w.archived_at is null
     and app.portal_item_visible(v_tid, p_project_id, w.id);

  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'quarter', e.quarter,
                                               'color', e.color, 'total', c.total, 'done', c.done)
                            order by e.key), '[]'::jsonb)
    into v_roadmap
    from public.epics e
    left join lateral (
      select count(*)::int as total,
             (count(*) filter (
                where lower(coalesce(w.status, '')) ~ '(done|closed|released|concluido|concluído)'
             ))::int as done
        from public.work_items w
       where w.epic_id = e.id
         and w.tenant_id = v_tid
         and w.archived_at is null
         and app.portal_item_visible(v_tid, p_project_id, w.id)
    ) c on true
   where e.project_id = p_project_id
     and e.tenant_id = v_tid
     and e.archived_at is null
     and e.client_visible is true;

  return jsonb_build_object('project', v_project, 'sprints', v_sprints,
                            'deliveries', v_deliveries, 'roadmap', v_roadmap);
end;
$$;

-- Conversa do projeto (opcionalmente de um item). Só campos que o cliente vê.
create or replace function app.portal_chat(p_project_id uuid, p_item_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tid uuid;
  v     jsonb;
begin
  select r.tenant_id into v_tid from app.portal_rows() r where r.project_id = p_project_id limit 1;
  if v_tid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'type', s.type, 'item_id', s.item_id, 'item_title', s.item_title,
           'author', s.author, 'body', s.body, 'created_at', s.created_at,
           'metadata', jsonb_build_object(
             'source',   coalesce(s.metadata ->> 'source', 'client'),
             'mentions', coalesce(s.metadata -> 'mentions', '[]'::jsonb))
         ) order by s.created_at), '[]'::jsonb)
    into v
    from public.client_signals s
   where s.tenant_id = v_tid
     and s.project_id = p_project_id
     and s.archived_at is null
     and (p_item_id is null or s.item_id = p_item_id);
  return v;
end;
$$;

-- Cliente envia mensagem. Autor e título do item vêm do SERVIDOR.
create or replace function app.portal_add_message(
  p_project_id uuid, p_body text, p_item_id uuid default null, p_mentions text[] default '{}'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row        public.client_portal_users;
  v_tid        uuid;
  v_body       text;
  v_item_title text;
  v_mentions   jsonb;
  v_id         uuid;
begin
  select r.* into v_row
    from app.portal_rows() r
   where r.project_id = p_project_id and r.can_comment
   limit 1;
  if v_row.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_tid := v_row.tenant_id;

  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' or length(v_body) > 5000 then
    raise exception 'invalid_body' using errcode = '22023';
  end if;

  if p_item_id is not null then
    if not app.portal_item_visible(v_tid, p_project_id, p_item_id) then
      raise exception 'item_not_visible' using errcode = '42501';
    end if;
    select w.title into v_item_title
      from public.work_items w where w.id = p_item_id and w.tenant_id = v_tid;
  end if;

  -- Só menciona responsáveis do projeto.
  select coalesce(jsonb_agg(distinct pr.profile_id), '[]'::jsonb)
    into v_mentions
    from public.project_client_responsibles pr
   where pr.tenant_id = v_tid
     and pr.project_id = p_project_id
     and pr.profile_id::text = any (coalesce(p_mentions, '{}'));

  insert into public.client_signals
    (tenant_id, project_id, type, item_id, item_title, author, body,
     read_by_po, reply_read_by_client, metadata)
  values
    (v_tid, p_project_id, 'comment', p_item_id, v_item_title, v_row.name, v_body,
     false, true, jsonb_build_object('source', 'client', 'mentions', v_mentions))
  returning id into v_id;

  insert into public.audit_logs (tenant_id, entity_type, entity_id, action, actor_name, before, after)
  values (v_tid, 'client_signal', v_id::text, 'portal.comment_created', v_row.name, null,
          jsonb_build_object('project_id', p_project_id, 'body', v_body));

  return jsonb_build_object('id', v_id);
end;
$$;

-- Cliente aprova uma entrega liberada a ele (exige can_approve no projeto).
create or replace function app.portal_approve(p_project_id uuid, p_work_item_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   public.client_portal_users;
  v_tid   uuid;
  v_title text;
  v_appr  uuid;
  v_sig   uuid;
begin
  select r.* into v_row
    from app.portal_rows() r
   where r.project_id = p_project_id and r.can_approve
   limit 1;
  if v_row.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_tid := v_row.tenant_id;

  if p_work_item_id is null or not app.portal_item_visible(v_tid, p_project_id, p_work_item_id) then
    raise exception 'item_not_visible' using errcode = '42501';
  end if;
  select w.title into v_title
    from public.work_items w where w.id = p_work_item_id and w.tenant_id = v_tid;

  insert into public.client_approvals
    (tenant_id, project_id, work_item_id, client_user_id, status, decided_at, metadata)
  values
    (v_tid, p_project_id, p_work_item_id, v_row.id, 'approved', now(),
     jsonb_build_object('item_title', v_title, 'author', v_row.name))
  returning id into v_appr;

  insert into public.audit_logs (tenant_id, entity_type, entity_id, action, actor_name, before, after)
  values (v_tid, 'client_approval', v_appr::text, 'portal.approved', v_row.name, null,
          jsonb_build_object('project_id', p_project_id, 'work_item_id', p_work_item_id));

  insert into public.client_signals
    (tenant_id, project_id, type, item_id, item_title, author,
     read_by_po, reply_read_by_client, metadata)
  values
    (v_tid, p_project_id, 'approval', p_work_item_id, v_title, v_row.name,
     false, true, jsonb_build_object('source', 'client'))
  returning id into v_sig;

  return jsonb_build_object('id', v_sig, 'approvalId', v_appr);
end;
$$;

-- Respostas da gestão ainda não lidas, nos projetos do cliente.
create or replace function app.portal_unread_replies()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'projectId', s.project_id,
           'project', coalesce(p.name, ''),
           'itemTitle', coalesce(s.item_title, 'Conversa geral'),
           'poReply', coalesce(s.po_reply, ''),
           'poReplyBy', s.metadata ->> 'po_reply_by'
         ) order by s.created_at desc), '[]'::jsonb)
    from public.client_signals s
    join (select distinct tenant_id, project_id from app.portal_rows()) r
      on r.tenant_id = s.tenant_id and r.project_id = s.project_id
    left join public.projects p on p.id = s.project_id and p.tenant_id = s.tenant_id
   where s.reply_read_by_client = false
     and s.po_reply is not null
     and s.archived_at is null
$$;

create or replace function app.portal_unread_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
    from public.client_signals s
    join (select distinct tenant_id, project_id from app.portal_rows()) r
      on r.tenant_id = s.tenant_id and r.project_id = s.project_id
   where s.reply_read_by_client = false
     and s.po_reply is not null
     and s.archived_at is null
$$;

-- Marca respostas como lidas (todas, ou só a do sinal informado).
create or replace function app.portal_mark_replies_read(p_signal_id uuid default null)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.client_signals s
     set reply_read_by_client = true
    from (select distinct tenant_id, project_id from app.portal_rows()) r
   where r.tenant_id = s.tenant_id
     and r.project_id = s.project_id
     and s.reply_read_by_client = false
     and (p_signal_id is null or s.id = p_signal_id)
$$;

-- Responsáveis do projeto (para @menção). Só id e nome — nunca e-mail.
create or replace function app.portal_responsibles(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tid uuid;
  v     jsonb;
begin
  select r.tenant_id into v_tid from app.portal_rows() r where r.project_id = p_project_id limit 1;
  if v_tid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', coalesce(nullif(btrim(p.name), ''), 'Responsável')
         ) order by p.name), '[]'::jsonb)
    into v
    from public.project_client_responsibles pr
    join public.profiles p on p.id = pr.profile_id and p.tenant_id = pr.tenant_id
   where pr.tenant_id = v_tid
     and pr.project_id = p_project_id
     and p.archived_at is null;
  return v;
end;
$$;

-- Registra o acesso do cliente (last_access_at).
create or replace function app.portal_touch_access()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.client_portal_users u
     set last_access_at = now()
    from app.portal_rows() r
   where u.id = r.id
$$;

-- Layout do dash (widgets) de um projeto do cliente.
create or replace function app.portal_dash_layout(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tid uuid;
  v     jsonb;
begin
  select r.tenant_id into v_tid from app.portal_rows() r where r.project_id = p_project_id limit 1;
  if v_tid is null then
    return null;
  end if;
  select p.client_dashboard_layout into v
    from public.projects p
   where p.id = p_project_id and p.tenant_id = v_tid and p.archived_at is null;
  if jsonb_typeof(v) = 'array' then
    return v;
  end if;
  return null;
end;
$$;

-- Cliente definiu a própria senha: encerra "troca obrigatória".
create or replace function app.portal_password_changed()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.client_portal_users u
     set password_must_change = false,
         status = case when u.status in ('invited', 'pending') then 'active' else u.status end
    from app.portal_rows() r
   where u.id = r.id
$$;

-- ─── 5. Wrappers expostos na API (SECURITY INVOKER, sem privilégio elevado) ──
create or replace function public.portal_context()
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_context() $$;

create or replace function public.portal_project_scope(p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_project_scope(p_project_id) $$;

create or replace function public.portal_chat(p_project_id uuid, p_item_id uuid default null)
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_chat(p_project_id, p_item_id) $$;

create or replace function public.portal_add_message(
  p_project_id uuid, p_body text, p_item_id uuid default null, p_mentions text[] default '{}'
)
returns jsonb language sql volatile security invoker set search_path = public, pg_temp
as $$ select app.portal_add_message(p_project_id, p_body, p_item_id, p_mentions) $$;

create or replace function public.portal_approve(p_project_id uuid, p_work_item_id uuid)
returns jsonb language sql volatile security invoker set search_path = public, pg_temp
as $$ select app.portal_approve(p_project_id, p_work_item_id) $$;

create or replace function public.portal_unread_replies()
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_unread_replies() $$;

create or replace function public.portal_unread_count()
returns integer language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_unread_count() $$;

create or replace function public.portal_mark_replies_read(p_signal_id uuid default null)
returns void language sql volatile security invoker set search_path = public, pg_temp
as $$ select app.portal_mark_replies_read(p_signal_id) $$;

create or replace function public.portal_responsibles(p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_responsibles(p_project_id) $$;

create or replace function public.portal_touch_access()
returns void language sql volatile security invoker set search_path = public, pg_temp
as $$ select app.portal_touch_access() $$;

create or replace function public.portal_dash_layout(p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$ select app.portal_dash_layout(p_project_id) $$;

create or replace function public.portal_password_changed()
returns void language sql volatile security invoker set search_path = public, pg_temp
as $$ select app.portal_password_changed() $$;

-- ─── 6. Permissões: só usuário LOGADO executa; anon nunca ────────────────────
-- (helpers app.portal_rows/module_active/item_visible NÃO são concedidos: só
--  são chamados de dentro das funções DEFINER, que rodam como dono.)
do $$
declare
  s    text;
  sigs text[] := array[
    'portal_context()',
    'portal_project_scope(uuid)',
    'portal_chat(uuid, uuid)',
    'portal_add_message(uuid, text, uuid, text[])',
    'portal_approve(uuid, uuid)',
    'portal_unread_replies()',
    'portal_unread_count()',
    'portal_mark_replies_read(uuid)',
    'portal_responsibles(uuid)',
    'portal_touch_access()',
    'portal_dash_layout(uuid)',
    'portal_password_changed()'
  ];
begin
  foreach s in array sigs loop
    execute format('revoke all on function app.%s from public, anon', s);
    execute format('grant execute on function app.%s to authenticated, service_role', s);
    execute format('revoke all on function public.%s from public, anon', s);
    execute format('grant execute on function public.%s to authenticated, service_role', s);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ============================================================================
-- OPCIONAL A (decisão sua) — manter o Roadmap atual de um dash já existente.
-- Por padrão todo épico começa "não visível": o Roadmap dos clientes atuais
-- fica vazio até o gestor marcar os épicos. Para liberar todos os épicos de UM
-- projeto (reproduz o que o cliente via antes), descomente e ajuste o nome:
--
-- update public.epics e
--    set client_visible = true
--   from public.projects p
--  where p.id = e.project_id and p.name = 'Papel Zero' and e.archived_at is null;
-- ============================================================================
