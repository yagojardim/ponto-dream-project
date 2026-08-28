/**
 * Altech — Marcos do tenant (audit_logs).
 * Um único helper de escrita para os eventos de negócio ("marcos") e a leitura
 * curada usada pelo card de Auditoria do Início. Nada é fabricado: o feed só
 * mostra o que foi realmente registrado em `audit_logs`.
 */
import { supabase } from '@/integrations/supabase/client'
import { DEFAULT_TENANT_ID } from '@/data/db/timeline'
import { safeCall, logger } from '@/utils/logger'

export type AuditValue = string | number | boolean | null
export type AuditAfter = Record<string, AuditValue>

interface AuditOpts {
  entityType?: string
  actorName?: string | null
}

function table(name: 'audit_logs') {
  return supabase.from(name)
}

/** Deriva o entity_type a partir do prefixo da ação (project.created → project). */
function entityTypeFor(action: string): string {
  const [prefix] = action.split('.')
  return prefix || 'tenant'
}

/** Registra um marco do tenant. Nunca lança — falha vira logger.error. */
export async function writeAudit(
  action: string,
  entityId: string | null,
  after: AuditAfter,
  opts: AuditOpts = {},
): Promise<void> {
  try {
    const { error } = await table('audit_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      entity_type: opts.entityType ?? entityTypeFor(action),
      entity_id: entityId,
      action,
      actor_name: opts.actorName ?? null,
      before: null,
      after,
    })
    if (error) throw error
  } catch (err) {
    logger.error('audit.writeAudit', err, { action, entityId })
  }
}

/**
 * Marcos de estado derivado (release em atraso, armazenamento cheio):
 * grava apenas na primeira detecção — nunca duplica a cada carregamento.
 */
export async function writeAuditOnce(
  action: string,
  entityId: string | null,
  after: AuditAfter,
  opts: AuditOpts = {},
): Promise<void> {
  try {
    let q = table('audit_logs')
      .select('id')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('action', action)
      .limit(1)
    q = entityId === null ? q.is('entity_id', null) : q.eq('entity_id', entityId)
    const { data, error } = await q
    if (error) throw error
    if ((data ?? []).length > 0) return
  } catch (err) {
    logger.error('audit.writeAuditOnce.check', err, { action, entityId })
    return
  }
  await writeAudit(action, entityId, after, opts)
}

// ─── Catálogo de marcos ───────────────────────────────────────────────────────

export interface MilestoneMeta {
  label: string
  icon: string
  color: 'accent' | 'success' | 'warn' | 'crit' | 'indigo' | 'purple' | 'muted'
}

/** action → rótulo amigável. Chaves ainda não instrumentadas ficam prontas aqui. */
export const MILESTONE_META: Record<string, MilestoneMeta> = {
  // Projetos
  'project.created':   { label: 'Projeto criado',      icon: '📁', color: 'accent' },
  'project.archived':  { label: 'Projeto arquivado',   icon: '🗄️', color: 'muted' },
  'project.finalized': { label: 'Projeto finalizado',  icon: '🏁', color: 'success' },
  // Boards
  'board.created':     { label: 'Board criado',        icon: '🗂️', color: 'indigo' },
  // Usuários
  'user.created':      { label: 'Usuário criado',      icon: '👤', color: 'accent' },
  'user.updated':      { label: 'Usuário atualizado',  icon: '✏️', color: 'muted' },
  'user.suspended':    { label: 'Usuário suspenso',    icon: '⛔', color: 'crit' },
  'user.deactivated':  { label: 'Usuário inativado',   icon: '🚫', color: 'warn' },
  'user.reactivated':  { label: 'Usuário reativado',   icon: '✅', color: 'success' },
  // Convites
  'invite.sent':       { label: 'Convite enviado',     icon: '✉️', color: 'accent' },
  'invite.accepted':   { label: 'Convite aceito',      icon: '🤝', color: 'success' },
  'invite.declined':   { label: 'Convite recusado',    icon: '↩️', color: 'warn' },
  // Módulos
  'module.activated':   { label: 'Módulo ativado',     icon: '🧩', color: 'success' },
  'module.deactivated': { label: 'Módulo desativado',  icon: '🧩', color: 'muted' },
  // Releases
  'release.created':   { label: 'Release criada',      icon: '🚀', color: 'indigo' },
  'release.finalized': { label: 'Release finalizada',  icon: '📦', color: 'success' },
  'release.overdue':   { label: 'Release em atraso',   icon: '⏰', color: 'crit' },
  // Dashview (portal do cliente)
  'dashview.created':          { label: 'Dashview criada',            icon: '🖥️', color: 'purple' },
  'dashview.deleted':          { label: 'Dashview excluída',          icon: '🗑️', color: 'muted' },
  'dashview_user.created':     { label: 'Acesso Dashview criado',     icon: '👥', color: 'purple' },
  'dashview_user.suspended':   { label: 'Acesso Dashview suspenso',   icon: '⛔', color: 'crit' },
  'dashview_user.deactivated': { label: 'Acesso Dashview inativado',  icon: '🚫', color: 'warn' },
  // Armazenamento
  'storage.full':      { label: 'Armazenamento cheio', icon: '💾', color: 'crit' },
  'storage.upgraded':  { label: 'Armazenamento ampliado', icon: '⬆️', color: 'success' },
}

export const MILESTONE_ACTIONS: string[] = Object.keys(MILESTONE_META)

export interface MilestoneRow {
  id: string
  action: string
  meta: MilestoneMeta
  /** Nome do alvo do marco (projeto, usuário, release…), quando registrado. */
  targetName: string | null
  projectId: string | null
  actorName: string | null
  createdAt: string
}

interface RawMilestone {
  id: string
  action: string | null
  entity_id: string | null
  actor_name: string | null
  after: unknown
  created_at: string
}

function readAfter(after: unknown): Record<string, unknown> {
  return after && typeof after === 'object' && !Array.isArray(after)
    ? (after as Record<string, unknown>)
    : {}
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

/** Feed curado de marcos do tenant, opcionalmente recortado por projeto. */
export function fetchMilestones(
  limit = 15,
  projectIds: readonly string[] = [],
  /** Quando informado, exclui marcos mais antigos que N dias. undefined = sem corte. */
  windowDays?: number,
): Promise<MilestoneRow[]> {
  return safeCall<MilestoneRow[]>('audit.fetchMilestones', async () => {
    let q = supabase
      .from('audit_logs')
      .select('id, action, entity_id, actor_name, after, created_at')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .in('action', MILESTONE_ACTIONS)

    if (windowDays != null && windowDays > 0) {
      const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
      q = q.gte('created_at', cutoff)
    }

    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 4, 60))
    if (error) throw error

    const rows = ((data ?? []) as unknown as RawMilestone[]).map(r => {
      const after = readAfter(r.after)
      const action = r.action ?? ''
      return {
        id: r.id,
        action,
        meta: MILESTONE_META[action] ?? { label: action, icon: '•', color: 'muted' as const },
        targetName: str(after.name) ?? str(after.title) ?? str(after.version) ?? str(after.email),
        projectId: str(after.project_id),
        actorName: r.actor_name,
        createdAt: r.created_at,
      }
    })

    const scoped = projectIds.length > 0
      ? rows.filter(r => r.projectId === null || projectIds.includes(r.projectId))
      : rows
    return scoped.slice(0, limit)
  }, [])
}
