/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence data layer — Fatia 1A (ingestão manual).
// Tabelas `meetings` e `meeting_action_items` (RLS por tenant via
// current_tenant_id()). O tenant_id é preenchido pelo DEFAULT do banco.
// As tabelas ainda não existem em integrations/supabase/types.ts, então
// usamos o mesmo cast de db/modules.ts para acessá-las.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { listModules } from '@/data/db/modules'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type MeetingStatus = 'processing' | 'ready' | 'failed'
export type MeetingSource = 'upload' | 'zoom' | 'meet' | 'teams' | 'record'

/** Chave estável do módulo no catálogo (MODULE_CATALOG / tabela modules). */
export const MEETING_MODULE_KEY = 'MEETING_INTELLIGENCE'

/** Resumo estruturado — preenchido na Fatia 1B (IA). Null enquanto não gerado. */
export interface MeetingSummary {
  objetivo?: string
  assunto?: string
  itens_discutidos?: string[]
  decisoes?: string[]
  pontos_definir?: string[]
  proximos_passos?: string[]
}

export interface MeetingRow {
  id: string
  tenant_id: string
  project_id: string | null
  title: string
  source: MeetingSource
  meeting_date: string | null
  duration_min: number | null
  status: MeetingStatus
  owner_id: string
  transcript: string | null
  summary: MeetingSummary | null
  created_at: string
  updated_at: string
}

export interface MeetingListItem {
  id: string
  title: string
  projectId: string | null
  projectName: string | null
  source: MeetingSource
  status: MeetingStatus
  meetingDate: string | null
  ownerId: string
  createdAt: string
}

export interface MeetingProjectOption {
  id: string
  name: string
}

export interface CreateMeetingInput {
  title: string
  projectId: string | null
  transcript: string
}

/** Módulo liberado para o tenant? (operational / implemented / preview) */
export async function isMeetingModuleEnabled(): Promise<boolean> {
  return safeCall('meetings.isMeetingModuleEnabled', async () => {
    const mods = await listModules()
    const m = mods.find(x => x.key === MEETING_MODULE_KEY)
    return !!m && (m.status === 'operational' || m.status === 'implemented' || m.status === 'preview')
  }, false)
}

/**
 * Lista as reuniões visíveis. Usuário padrão vê só as próprias; o admin
 * (dono do tenant) vê todas. A RLS já garante o isolamento por tenant.
 */
export async function fetchMeetings(opts: { ownerId: string; isAdmin: boolean }): Promise<MeetingListItem[]> {
  return safeCall('meetings.fetchMeetings', async () => {
    let query = tbl('meetings')
      .select('id, title, project_id, source, status, meeting_date, owner_id, created_at, projects(name)')
      .order('created_at', { ascending: false })
    if (!opts.isAdmin) query = query.eq('owner_id', opts.ownerId)
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as any[]).map((r): MeetingListItem => {
      const proj = Array.isArray(r.projects) ? r.projects[0] : r.projects
      return {
        id: r.id,
        title: r.title,
        projectId: r.project_id ?? null,
        projectName: proj?.name ?? null,
        source: r.source,
        status: r.status,
        meetingDate: r.meeting_date ?? null,
        ownerId: r.owner_id,
        createdAt: r.created_at,
      }
    })
  }, [])
}

/** Detalhe completo de uma reunião (transcrição + resumo). */
export async function fetchMeeting(id: string): Promise<MeetingRow | null> {
  return safeCall('meetings.fetchMeeting', async () => {
    const { data, error } = await tbl('meetings').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return (data as MeetingRow) ?? null
  }, null)
}

/** Projetos do tenant para o select do formulário (RLS isola por tenant). */
export async function fetchProjectOptions(): Promise<MeetingProjectOption[]> {
  return safeCall('meetings.fetchProjectOptions', async () => {
    const { data, error } = await tbl('projects').select('id, name').order('name', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(p => ({ id: p.id, name: p.name }))
  }, [])
}

/**
 * Cria a reunião por transcrição colada. Não envia tenant_id (DEFAULT do banco
 * = current_tenant_id()). Resumo fica null (gerado na Fatia 1B). Retorna o id.
 */
export async function createMeeting(input: CreateMeetingInput, ownerId: string): Promise<string | null> {
  return safeCall('meetings.createMeeting', async () => {
    const { data, error } = await tbl('meetings').insert({
      title: input.title.trim(),
      project_id: input.projectId,
      source: 'upload',
      status: 'ready',
      owner_id: ownerId,
      transcript: input.transcript,
      summary: null,
    }).select('id').single()
    if (error) throw error
    return (data?.id as string) ?? null
  }, null)
}
