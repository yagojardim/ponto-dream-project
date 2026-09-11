// log-event: captura de logs de PRODUTO por tenant (tela de Suporte).
// Chamada pelo FRONT AUTENTICADO. tenant_id/profile_id são derivados do JWT
// no servidor (nunca confia no que o cliente manda). Escreve com service_role.
//
// IMPORTANTE (@devops): mantém verify_jwt = TRUE. Já declarado em supabase/config.toml:
//   [functions.log-event]
//   verify_jwt = true
// Secrets necessários (já presentes no projeto): SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { redactContext } from '../_shared/redact.ts'

const LEVELS = ['debug', 'info', 'warn', 'error'] as const
type Level = (typeof LEVELS)[number]

const MAX_MESSAGE = 4000
const MAX_AREA = 200
const MAX_CORRELATION = 64

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function asLevel(v: unknown): Level {
  return typeof v === 'string' && (LEVELS as readonly string[]).includes(v) ? (v as Level) : 'info'
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

// correlation_id: aceita só um id "limpo" do cliente; caso contrário gera um novo.
function safeCorrelationId(v: unknown): string {
  if (typeof v === 'string') {
    const s = v.trim()
    if (s.length > 0 && s.length <= MAX_CORRELATION && /^[A-Za-z0-9._:-]+$/.test(s)) return s
  }
  return crypto.randomUUID()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing_authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('log-event: env ausente (SUPABASE_URL/ANON/SERVICE_ROLE)')
    return json({ error: 'server_misconfigured' }, 500)
  }

  let payload: {
    level?: unknown; area?: unknown; message?: unknown
    context?: unknown; correlation_id?: unknown
  }
  try {
    payload = await req.json()
  } catch (_err) {
    return json({ error: 'invalid_json' }, 400)
  }

  const message = clip(payload.message, MAX_MESSAGE)
  if (!message) return json({ error: 'message_required' }, 400)
  const level = asLevel(payload.level)
  const area = clip(payload.area, MAX_AREA)
  const correlationId = safeCorrelationId(payload.correlation_id)
  const context = redactContext(payload.context ?? {})

  try {
    // Deriva o usuário a partir do JWT (client com o token do chamador).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
    const authUserId = userData.user.id

    // Serviço com service_role para resolver o profile e gravar (ignora RLS).
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: profile } = await admin
      .from('profiles')
      .select('id, tenant_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    const row = {
      tenant_id: (profile?.tenant_id as string | undefined) ?? null,
      profile_id: (profile?.id as string | undefined) ?? null,
      level,
      area,
      message,
      context,
      correlation_id: correlationId,
    }

    const { error } = await admin.from('support_logs').insert(row)
    if (error) {
      console.error('log-event: insert falhou', error)
      return json({ error: 'db_error' }, 500)
    }
  } catch (err) {
    console.error('log-event: handler falhou', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'internal' }, 500)
  }

  return json({ ok: true, correlation_id: correlationId })
})
