-- Adiciona coluna filter à tabela boards.
-- Guarda o escopo do board no formato do Construtor de Filtros:
-- { "logic": "AND" | "OR", "conditions": [ { "field": ..., "operator": ..., "value": ... } ] }
-- {} (vazio) = board sem filtro = todas as demandas do projeto.
-- Herda as RLS policies existentes de boards.

alter table public.boards
  add column if not exists filter jsonb not null default '{}'::jsonb;
