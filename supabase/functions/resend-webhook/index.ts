// Webhook do Resend: recebe eventos de e-mail, valida a assinatura (Svix) e grava em email_events.
// Roda server-side com service_role. Público (sem JWT) — Resend não envia JWT do Supabase.
// IMPORTANTE (@devops): registrar em supabase/config.toml:
//   [functions.resend-webhook]
//   verify_jwt = false
// Secrets necessários: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_WEBHOOK_SECRET (whsec_...)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Verificação de assinatura Svix (padrão usado pelo Resend).
async function verifySvix(secret: string, id: string, ts: string, body: string, sigHeader: string): Promise<boolean> {
  try {
    const b64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
    const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signed = `${id}.${ts}.${body}`
    const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signed))
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
    // sigHeader: "v1,<b64> v1,<b64>..." — aceita se qualquer assinatura bater.
    const provided = sigHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean)
    return provided.some((p) => p === expected)
  } catch (err) {
    console.error('verifySvix error', err)
    return false
  }
}

function pickTenantId(data: Record<string, unknown>): string | null {
  const tags = data?.tags
  if (Array.isArray(tags)) {
    const t = tags.find((x) => x && typeof x === 'object' && (x as { name?: string }).name === 'tenant_id')
    const v = t && (t as { value?: string }).value
    return typeof v === 'string' && v.length > 0 ? v : null
  }
  return null
}
function pickTemplateKey(data: Record<string, unknown>): string | null {
  const tags = data?.tags
  if (Array.isArray(tags)) {
    const t = tags.find((x) => x && typeof x === 'object' && (x as { name?: string }).name === 'template_key')
    const v = t && (t as { value?: string }).value
    return typeof v === 'string' && v.length > 0 ? v : null
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    console.error('RESEND_WEBHOOK_SECRET ausente')
    return json({ error: 'server_misconfigured' }, 500)
  }

  const raw = await req.text()
  const svixId = req.headers.get('svix-id') ?? ''
  const svixTs = req.headers.get('svix-timestamp') ?? ''
  const svixSig = req.headers.get('svix-signature') ?? ''
  if (!svixId || !svixTs || !svixSig) return json({ error: 'missing_signature_headers' }, 400)

  const ok = await verifySvix(secret, svixId, svixTs, raw, svixSig)
  if (!ok) return json({ error: 'invalid_signature' }, 401)

  let evt: { type?: string; created_at?: string; data?: Record<string, unknown> }
  try {
    evt = JSON.parse(raw)
  } catch (_err) {
    return json({ error: 'invalid_json' }, 400)
  }

  const data = evt.data ?? {}
  const toRaw = (data as { to?: unknown }).to
  const toEmail = Array.isArray(toRaw) ? String(toRaw[0] ?? '') : (typeof toRaw === 'string' ? toRaw : '')

  const row = {
    tenant_id: pickTenantId(data),
    provider: 'resend',
    message_id: (data as { email_id?: string }).email_id ?? null,
    event_type: evt.type ?? 'unknown',
    to_email: toEmail || null,
    from_email: (data as { from?: string }).from ?? null,
    subject: (data as { subject?: string }).subject ?? null,
    template_key: pickTemplateKey(data),
    payload: evt as unknown as Record<string, unknown>,
    occurred_at: (data as { created_at?: string }).created_at ?? evt.created_at ?? null,
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    // Idempotente: ignora conflito no índice (message_id, event_type, occurred_at).
    const { error } = await supabase.from('email_events').insert(row)
    if (error && !String(error.message).toLowerCase().includes('duplicate')) {
      console.error('insert email_events failed', error)
      return json({ error: 'db_error' }, 500)
    }
  } catch (err) {
    console.error('resend-webhook handler failed', err)
    return json({ error: 'internal' }, 500)
  }

  return json({ ok: true })
})
