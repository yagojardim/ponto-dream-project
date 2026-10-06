// Login do Portal do Cliente (pós-autenticação): a senha é validada pelo próprio
// Supabase Auth no front (signInWithPassword). Esta função recebe o JWT dessa
// sessão, descobre QUAIS acessos de portal pertencem àquele usuário e devolve
// APENAS o mínimo para montar a sessão do portal.
//
// Segurança:
//  - identidade vem do JWT (nunca do corpo da requisição);
//  - o vínculo por e-mail só vale com e-mail CONFIRMADO no Auth (quem se cadastra
//    com o e-mail de um cliente sem confirmar não herda o acesso dele);
//  - staff (tem profile) não entra no portal por aqui;
//  - nunca expõe linhas de outros tenants/clientes nem credenciais.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const WINDOW_MS = 60_000
const MAX_HITS = 15
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const cur = hits.get(ip)
  if (!cur || cur.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  cur.count += 1
  return cur.count > MAX_HITS
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Escapa curingas do LIKE (% _ \) — '_' é comum em e-mail e casaria outro cliente. */
function likeEscape(v: string): string {
  return v.replace(/[\\%_]/g, '\\$&')
}

interface PortalRow {
  id: string
  tenant_id: string
  project_id: string
  name: string
  email: string
  portal_role: 'viewer' | 'portal-admin'
  can_approve: boolean
  can_preview: boolean
  can_comment: boolean
  status: string
  auth_user_id: string | null
}

const COLUMNS = 'id, tenant_id, project_id, name, email, portal_role, can_approve, can_preview, can_comment, status, auth_user_id'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(ip)) return json({ ok: false, error: 'rate_limited' }, 429)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ ok: false, error: 'invalid_credentials' }, 401)

    const email = (user.email ?? '').trim().toLowerCase()
    if (!email || !user.email_confirmed_at) return json({ ok: false, error: 'invalid_credentials' }, 403)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // Staff não usa o portal do cliente.
    const { data: staff, error: staffErr } = await admin
      .from('profiles').select('id').eq('auth_user_id', user.id).limit(1)
    if (staffErr) throw staffErr
    if (staff?.length) return json({ ok: false, error: 'not_portal_user' }, 403)

    const { data: linked, error: linkedErr } = await admin
      .from('client_portal_users').select(COLUMNS)
      .eq('auth_user_id', user.id).is('archived_at', null)
    if (linkedErr) throw linkedErr

    const { data: unlinked, error: unlinkedErr } = await admin
      .from('client_portal_users').select(COLUMNS)
      .is('auth_user_id', null).ilike('email', likeEscape(email)).is('archived_at', null)
    if (unlinkedErr) throw unlinkedErr

    const rows = [...(linked ?? []), ...(unlinked ?? [])] as PortalRow[]
    if (rows.length === 0) return json({ ok: false, error: 'not_portal_user' }, 403)

    // Todas as linhas pertencem ao mesmo usuário; consolidamos no tenant da primeira.
    const tenantId = rows[0].tenant_id
    const scoped = rows.filter(r => r.tenant_id === tenantId)

    // 1º login real: grava o vínculo. A senha foi definida pelo próprio cliente
    // (link de convite), então a troca obrigatória não se aplica.
    const toLink = scoped.filter(r => r.auth_user_id === null).map(r => r.id)
    if (toLink.length) {
      const { error: linkErr } = await admin
        .from('client_portal_users')
        .update({ auth_user_id: user.id, password_must_change: false, status: 'active' })
        .in('id', toLink)
      if (linkErr) throw linkErr
    }

    return json({
      ok: true,
      user: {
        id: scoped[0].id,
        name: scoped[0].name,
        email: scoped[0].email,
        tenantId,
        permission: scoped.some(r => r.portal_role === 'portal-admin') ? 'admin' : 'viewer',
        mustChangePassword: false,
        canApprove: scoped.some(r => r.can_approve),
        canPreview: scoped.some(r => r.can_preview),
        canComment: scoped.some(r => r.can_comment),
        projectIds: scoped.map(r => r.project_id),
      },
    })
  } catch (err) {
    console.error('client-portal-login failed', (err as Error)?.message)
    return json({ ok: false, error: 'server_error' }, 500)
  }
})
