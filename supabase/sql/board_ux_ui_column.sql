-- Adiciona a coluna "UX/UI" (status_key 'ux_ui') aos boards que ainda não a têm,
-- posicionada logo após "A Fazer" (etapa de design ANTES do desenvolvimento).
-- O P.O. move o item para essa coluna e aponta o UX responsável (assignee do item).
-- Idempotente: reexecutar NÃO duplica (pula boards que já têm a coluna).
-- Herda as RLS policies existentes de board_columns / board_column_statuses.
-- Boards novos já nascem com a coluna (ver src/data/db/boardColumnDefs.ts).

do $$
declare
  b record;
  ins_pos int;
  new_col_id uuid;
begin
  for b in
    select id, tenant_id from public.boards where archived_at is null
  loop
    -- pula boards que já possuem a coluna UX/UI
    if exists (
      select 1 from public.board_columns c
      where c.board_id = b.id and (c.category = 'ux_ui' or lower(c.name) = 'ux/ui')
    ) then
      continue;
    end if;

    -- posição de inserção: logo após "A Fazer"; senão após a última coluna 'todo'; senão 1
    select coalesce(
      (select position + 1 from public.board_columns
         where board_id = b.id and lower(name) = 'a fazer'
         order by position limit 1),
      (select position + 1 from public.board_columns
         where board_id = b.id and category = 'todo'
         order by position desc limit 1),
      1
    ) into ins_pos;

    -- abre espaço deslocando as colunas seguintes
    update public.board_columns
      set position = position + 1
      where board_id = b.id and position >= ins_pos;

    -- insere a coluna UX/UI. category = 'in_progress' (valor aceito pelo CHECK
    -- board_columns_category_check); a cor roxa vem do nome em columnColor().
    insert into public.board_columns (tenant_id, board_id, name, category, position)
      values (b.tenant_id, b.id, 'UX/UI', 'in_progress', ins_pos)
      returning id into new_col_id;

    -- mapeia o status 'ux_ui' para a nova coluna
    insert into public.board_column_statuses (tenant_id, board_column_id, status_key)
      values (b.tenant_id, new_col_id, 'ux_ui');
  end loop;
end $$;
