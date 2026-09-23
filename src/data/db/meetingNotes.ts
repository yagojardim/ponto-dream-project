/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — notas da reunião (Onda A, funciona já). Fase 2.
// RLS-off + tenant-cliente (padrão 1A). Nome do autor resolvido via getMembers().
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'
import { getMembers } from '@/data/db/members'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export interface MeetingNote {
  id: string
  meetingId: string
  authorId: string | null
  authorName: string | null
  body: string
  timeAnchor: string | null
  createdAt: string
}

export interface CreateNoteInput {
  meetingId: string
  body: string
  timeAnchor?: string | null
}

/** Notas de uma reunião, mais recentes por último, com o nome do autor resolvido. */
export async function listNotes(meetingId: string): Promise<MeetingNote[]> {
  return safeCall('meetingNotes.listNotes', async () => {
    const { data, error } = await tbl('meeting_notes')
      .select('id, meeting_id, author_id, body, time_anchor, created_at')
      .eq('tenant_id', getActiveTenantId())
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as any[]
    const names = await namesById()
    return rows.map((r): MeetingNote => ({
      id: r.id,
      meetingId: r.meeting_id,
      authorId: r.author_id ?? null,
      authorName: r.author_id ? (names.get(r.author_id) ?? null) : null,
      body: r.body,
      timeAnchor: r.time_anchor ?? null,
      createdAt: r.created_at,
    }))
  }, [])
}

export async function createNote(input: CreateNoteInput, authorId: string): Promise<string | null> {
  return safeCall('meetingNotes.createNote', async () => {
    const { data, error } = await tbl('meeting_notes').insert({
      tenant_id: getActiveTenantId(),
      meeting_id: input.meetingId,
      author_id: authorId,
      body: input.body.trim(),
      time_anchor: input.timeAnchor?.trim() || null,
    }).select('id').single()
    if (error) throw error
    return (data?.id as string) ?? null
  }, null)
}

export async function deleteNote(id: string): Promise<boolean> {
  return safeCall('meetingNotes.deleteNote', async () => {
    const { error } = await tbl('meeting_notes')
      .delete().eq('id', id).eq('tenant_id', getActiveTenantId())
    if (error) throw error
    return true
  }, false)
}

async function namesById(): Promise<Map<string, string>> {
  const members = await getMembers()
  return new Map(members.map(m => [m.id, m.name]))
}
