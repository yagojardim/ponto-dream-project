// Convite do Portal do Cliente: gera o link para o cliente DEFINIR a própria senha.
// Chamada pelo front AUTENTICADO (equipe do tenant). Nunca envia e-mail nem expõe
// senha: devolve só o link (action_link) para o gestor repassar até o canal de
// e-mail (Resend) estar ativo.
//
// Regras:
//  - o chamador precisa ser staff ativo do MESMO tenant do acesso (papel com
//    capability access:client-portal ou dono do tenant);
//  - o e-mail precisa existir em client_portal_users desse tenant;
//  - e-mail que pertence a staff (tem profile) nunca vira cliente de portal.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const PORTAL_PATH = '/reset-password'

// Papéis com access:client-portal (ver src/data/permissions.ts).
const ALLOWED_ROLES = new Set([
  'admin', 'admin_master', 'administrador', 'pmo', 'project_manager', 'projectmanager', 'pm',
  'product_manager', 'productmanager', 'product_owner', 'productowner', 'po',
  'scrum_master', 'scrummaster', 'sm', 'tech_lead', 'techlead', 'tl',
])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Escapa curingas do LIKE (% _ \) — '_' é comum em e-mail e casaria outra pessoa. */
function likeEscape(v: string): string {
  return v.replace(/[\\%_]/g, '\\$&')
}

function normRole(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let email = ''
  try {
    const body = await req.json()
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400)
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ ok: false, error: 'sign_in_required' }, 401)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // 1) Chamador = staff ativo com permissão de portal.
    const { data: me, error: meErr } = await admin
      .from('profiles')
      .select('id, tenant_id, status, primary_role, tenant_owner')
      .eq('auth_user_id', user.id)
      .limit(1)
    if (meErr) throw meErr
    const profile = me?.[0]
    if (!profile || (profile.status && profile.status !== 'active')) {
      return json({ ok: false, error: 'forbidden' }, 403)
    }
    if (!profile.tenant_owner && !ALLOWED_ROLES.has(normRole(profile.primary_role))) {
      return json({ ok: false, error: 'forbidden' }, 403)
    }

    // 2) O e-mail precisa ser um acesso de portal DESTE tenant.
    const { data: rows, error: rowsErr } = await admin
      .from('client_portal_users')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .ilike('email', likeEscape(email))
      .is('archived_at', null)
      .limit(1)
    if (rowsErr) throw rowsErr
    if (!rows?.length) return json({ ok: false, error: 'not_found' }, 404)

    // 3) E-mail de staff nunca vira cliente de portal.
    const { data: staff, error: staffErr } = await admin
      .from('profiles').select('id').ilike('email', likeEscape(email)).limit(1)
    if (staffErr) throw staffErr
    if (staff?.length) return json({ ok: false, error: 'email_belongs_to_staff' }, 409)

    const redirectBase = (Deno.env.get('PORTAL_SITE_URL') ?? '').replace(/\/+$/, '')
    const options = redirectBase ? { redirectTo: `${redirectBase}${PORTAL_PATH}` } : undefined

    // 4) Usuário novo → invite (cria o usuário sem senha). Já existente → recovery.
    let link = await admin.auth.admin.generateLink({ type: 'invite', email, options })
    let existing = false
    if (link.error) {
      existing = true
      link = await admin.auth.admin.generateLink({ type: 'recovery', email, options })
    }
    if (link.error || !link.data?.properties?.action_link) {
      console.error('portal-invite generateLink failed', link.error?.message)
      return json({ ok: false, error: 'link_failed' }, 500)
    }

    // Marca o usuário como cliente de portal (sem privilégio algum — só rótulo).
    const authId = link.data.user?.id
    if (authId) {
      await admin.auth.admin.updateUserById(authId, { app_metadata: { portal: true } })
    }

    return json({ ok: true, existing, link: link.data.properties.action_link })
  } catch (err) {
    console.error('portal-invite failed', (err as Error)?.message)
    return json({ ok: false, error: 'server_error' }, 500)
  }
})
