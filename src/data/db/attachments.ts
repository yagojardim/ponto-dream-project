// Attachments data layer — real uploads/downloads against the private
// `attachments` storage bucket plus the `attachments` table.
// Same pattern as the other db/* modules: tenant-scoped, safeCall, no `any`.
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { safeCall } from '@/utils/logger'

type Tables = Database['public']['Tables']

const BUCKET = 'attachments'
const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024

export interface AttachmentRow {
  id: string
  name: string
  size_bytes: number | null
  mime_type: string | null
  storage_path: string | null
  scan_status: string
  created_by: string | null
  created_at: string
  /** Display name of the profile that uploaded the file (join on profiles). */
  uploaded_by_name: string | null
}

// ─── Allowlist ────────────────────────────────────────────────────────────────
export const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'pdf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt',
  'zip',
] as const

export const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'js', 'mjs', 'html', 'htm', 'svg',
  'jar', 'msi', 'dll', 'scr', 'com', 'ps1', 'vbs',
] as const

const ALLOWED_MIME_PREFIXES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
]

/** Accept attribute for the hidden file input. */
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map(e => `.${e}`).join(',')

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

export function isAllowedFile(name: string, mime: string): boolean {
  const ext = extensionOf(name)
  if (!ext || (BLOCKED_EXTENSIONS as readonly string[]).includes(ext)) return false
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return false
  // Empty mime (some browsers) is tolerated: the extension already passed.
  if (!mime) return true
  return ALLOWED_MIME_PREFIXES.some(p => mime.toLowerCase().startsWith(p))
}

export function bytesToHuman(bytes: number | null | undefined): string {
  const n = bytes ?? 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/** Maps the storage-limit trigger errors to friendly Portuguese messages. */
function friendlyDbError(message: string): string {
  if (message.includes('FILE_TOO_LARGE')) return 'Arquivo maior que o limite do plano'
  if (message.includes('TENANT_QUOTA_EXCEEDED')) return 'Cota de armazenamento do tenant esgotada'
  if (message.includes('PROJECT_FILE_LIMIT')) return 'Limite de arquivos do projeto atingido'
  return message
}

// ─── Reads ────────────────────────────────────────────────────────────────────
type ProfileLite = Pick<Tables['profiles']['Row'], 'id' | 'name'>

/** Non-archived attachments of a work item, newest first. Degrades to []. */
export async function listAttachments(tenantId: string, workItemId: string): Promise<AttachmentRow[]> {
  return safeCall('attachments.listAttachments', async () => {
    const res = await supabase
      .from('attachments')
      .select('id, name, size_bytes, mime_type, storage_path, scan_status, created_by, created_at')
      .eq('tenant_id', tenantId)
      .eq('work_item_id', workItemId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    if (res.error) throw new Error(res.error.message)

    const rows = res.data ?? []
    const authorIds = Array.from(new Set(rows.map(r => r.created_by).filter((v): v is string => !!v)))
    let byId = new Map<string, ProfileLite>()
    if (authorIds.length) {
      const profRes = await supabase
        .from('profiles').select('id, name').eq('tenant_id', tenantId).in('id', authorIds)
      if (!profRes.error) byId = new Map((profRes.data ?? []).map(p => [p.id, p]))
    }

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      size_bytes: r.size_bytes === null ? null : Number(r.size_bytes),
      mime_type: r.mime_type,
      storage_path: r.storage_path,
      scan_status: r.scan_status,
      created_by: r.created_by,
      created_at: r.created_at,
      uploaded_by_name: r.created_by ? (byId.get(r.created_by)?.name ?? null) : null,
    }))
  }, [], { tenantId, workItemId })
}

async function maxFileBytes(tenantId: string): Promise<number> {
  return safeCall('attachments.maxFileBytes', async () => {
    const res = await supabase
      .from('tenant_settings').select('max_file_bytes').eq('tenant_id', tenantId).maybeSingle()
    if (res.error) throw new Error(res.error.message)
    const value = res.data?.max_file_bytes
    return value == null ? DEFAULT_MAX_FILE_BYTES : Number(value)
  }, DEFAULT_MAX_FILE_BYTES, { tenantId })
}

// ─── Writes ───────────────────────────────────────────────────────────────────
export interface UploadArgs {
  tenantId: string
  workItemId: string
  file: File
  profileId: string | null
}

/** Uploads to the private bucket and registers the row. Throws friendly errors. */
export async function uploadAttachment({ tenantId, workItemId, file, profileId }: UploadArgs): Promise<AttachmentRow> {
  if (!isAllowedFile(file.name, file.type)) {
    throw new Error('Tipo de arquivo não permitido')
  }

  const limit = await maxFileBytes(tenantId)
  if (file.size > limit) {
    throw new Error('Arquivo excede o limite do plano')
  }

  const checksum = await sha256Hex(file)
  const path = `${tenantId}/${workItemId}/${crypto.randomUUID()}-${sanitizeName(file.name)}`

  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (up.error) throw new Error(friendlyDbError(up.error.message))

  const insert = await supabase
    .from('attachments')
    .insert({
      tenant_id: tenantId,
      work_item_id: workItemId,
      name: file.name,
      url: path,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || null,
      kind: 'file',
      checksum_sha256: checksum,
      created_by: profileId,
    })
    .select('id, name, size_bytes, mime_type, storage_path, scan_status, created_by, created_at')
    .single()

  if (insert.error) {
    // Never leave an orphan object behind when the row could not be written.
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(friendlyDbError(insert.error.message))
  }

  const r = insert.data

  // Registra no histórico da demanda (nunca bloqueia o upload).
  await safeCall('attachments.auditUpload', async () => {
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      entity_type: 'work_item',
      entity_id: workItemId,
      action: 'attachment_added',
      actor_id: profileId,
      after: {
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        attachment_id: r.id,
        work_item_id: workItemId,
      },
    })
    return null
  }, null, { workItemId })

  return {
    id: r.id,
    name: r.name,
    size_bytes: r.size_bytes === null ? null : Number(r.size_bytes),
    mime_type: r.mime_type,
    storage_path: r.storage_path,
    scan_status: r.scan_status,
    created_by: r.created_by,
    created_at: r.created_at,
    uploaded_by_name: null,
  }
}

/** Short-lived signed URL that forces a download. */
export async function getDownloadUrl(storagePath: string): Promise<string | null> {
  return safeCall('attachments.getDownloadUrl', async () => {
    const res = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60, { download: true })
    if (res.error) throw new Error(res.error.message)
    return res.data?.signedUrl ?? null
  }, null, { storagePath })
}

// ─── Project repository (Gestão de Armazenamento) ────────────────────────────
export interface ProjectAttachmentRow extends AttachmentRow {
  work_item_id: string
  work_item_key: string
  work_item_title: string
  board_id: string | null
  board_name: string | null
}

export interface ProjectBoardOption { id: string; name: string }

/** All non-archived attachments of a project's work items, newest first. */
export async function listProjectAttachments(
  tenantId: string,
  projectId: string,
  boardId?: string,
): Promise<ProjectAttachmentRow[]> {
  return safeCall('attachments.listProjectAttachments', async () => {
    let itemsQuery = supabase
      .from('work_items')
      .select('id, key, title, board_id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
    if (boardId) itemsQuery = itemsQuery.eq('board_id', boardId)

    const itemsRes = await itemsQuery
    if (itemsRes.error) throw new Error(itemsRes.error.message)
    const items = itemsRes.data ?? []
    if (items.length === 0) return []

    const itemById = new Map(items.map(i => [i.id, i]))

    const attRes = await supabase
      .from('attachments')
      .select('id, name, size_bytes, mime_type, storage_path, scan_status, created_by, created_at, work_item_id')
      .eq('tenant_id', tenantId)
      .in('work_item_id', items.map(i => i.id))
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    if (attRes.error) throw new Error(attRes.error.message)
    const rows = attRes.data ?? []
    if (rows.length === 0) return []

    const boardIds = Array.from(new Set(items.map(i => i.board_id).filter((v): v is string => !!v)))
    const authorIds = Array.from(new Set(rows.map(r => r.created_by).filter((v): v is string => !!v)))

    const [boardsRes, profRes] = await Promise.all([
      boardIds.length
        ? supabase.from('boards').select('id, name').eq('tenant_id', tenantId).in('id', boardIds)
        : Promise.resolve({ data: [], error: null }),
      authorIds.length
        ? supabase.from('profiles').select('id, name').eq('tenant_id', tenantId).in('id', authorIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const boardName = new Map((boardsRes.data ?? []).map(b => [b.id, b.name]))
    const authorName = new Map((profRes.data ?? []).map(p => [p.id, p.name]))

    return rows.map(r => {
      const item = itemById.get(r.work_item_id)
      return {
        id: r.id,
        name: r.name,
        size_bytes: r.size_bytes === null ? null : Number(r.size_bytes),
        mime_type: r.mime_type,
        storage_path: r.storage_path,
        scan_status: r.scan_status,
        created_by: r.created_by,
        created_at: r.created_at,
        uploaded_by_name: r.created_by ? (authorName.get(r.created_by) ?? null) : null,
        work_item_id: r.work_item_id,
        work_item_key: item?.key ?? '—',
        work_item_title: item?.title ?? '—',
        board_id: item?.board_id ?? null,
        board_name: item?.board_id ? (boardName.get(item.board_id) ?? null) : null,
      }
    })
  }, [], { tenantId, projectId, boardId })
}

/** Boards used by a project (for the repository filter). */
export async function listProjectBoards(tenantId: string, projectId: string): Promise<ProjectBoardOption[]> {
  return safeCall('attachments.listProjectBoards', async () => {
    const res = await supabase
      .from('boards')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('name')
    if (res.error) throw new Error(res.error.message)
    return (res.data ?? []).map(b => ({ id: b.id, name: b.name }))
  }, [], { tenantId, projectId })
}

export interface DeleteAttachmentInput {
  attachment: ProjectAttachmentRow
  tenantId: string
  actorId: string | null
  actorName: string
  projectName?: string
}

export interface DeleteResult { ok: boolean; error?: string }

/** Removes the storage object, records the audit entry and deletes the row. */
export async function deleteAttachment(input: DeleteAttachmentInput): Promise<DeleteResult> {
  const { attachment, tenantId, actorId, actorName, projectName } = input
  return safeCall('attachments.deleteAttachment', async (): Promise<DeleteResult> => {
    if (attachment.storage_path) {
      const rm = await supabase.storage.from(BUCKET).remove([attachment.storage_path])
      if (rm.error) throw new Error(rm.error.message)
    }

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      entity_type: 'attachment',
      entity_id: attachment.id,
      action: 'attachment_deleted',
      actor_id: actorId,
      actor_name: actorName,
      before: {
        name: attachment.name,
        size_bytes: attachment.size_bytes,
        project: projectName ?? null,
        work_item: attachment.work_item_key,
      },
    })

    const del = await supabase
      .from('attachments').delete().eq('id', attachment.id).eq('tenant_id', tenantId)
    if (del.error) throw new Error(del.error.message)

    return { ok: true }
  }, { ok: false, error: 'Não foi possível excluir o arquivo' }, { attachmentId: attachment.id })
}

const DELETE_ROLES = ['Admin', 'ProjectManager', 'ProductOwner', 'TechLead'] as const

/** Dev can view/download but not delete. */
export function canDeleteAttachments(roleContext: string): boolean {
  return (DELETE_ROLES as readonly string[]).includes(roleContext)
}
