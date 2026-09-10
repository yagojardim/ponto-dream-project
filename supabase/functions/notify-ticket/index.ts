// notify-ticket: envia um e-mail para o suporte quando um chamado é aberto na
// plataforma (aba "Reportar problema / suporte"). Chamada pelo FRONT AUTENTICADO
// após gravar em `feedback`. Deriva tenant/autor do JWT (não confia no cliente).
//
// IMPORTANTE (@devops): verify_jwt = TRUE (já declarado em supabase/config.toml).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
// Requer domínio altechlab.com.br VERIFICADO no Resend (envio) e uma caixa/forward
// em suporte@altechlab.com.br (recebimento) para a mensagem realmente chegar.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendEmail } from '../_shared/email.ts'

const SUPPORT_INBOX = 'suporte@altechlab.com.br'
const MAX_MESSAGE = 8000

const TYPE_LABEL: Record<string, string> = {
  problema: 'Problema',
  sugestao: 'Sugestão',
  feedback: 'Feedback',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px;color:#5C5C7A;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td>
    <td style="padding:6px 12px;color:#111;font-size:13px">${value}</td>
  </tr>`
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
    console.error('notify-ticket: env ausente')
    return json({ error: 'server_misconfigured' }, 500)
  }

  let payload: {
    type?: unknown; message?: unknown
    screen_url?: unknown; screen_label?: unknown; correlation_id?: unknown
  }
  try {
    payload = await req.json()
  } catch (_err) {
    return json({ error: 'invalid_json' }, 400)
  }

  const type = typeof payload.type === 'string' ? payload.type : 'problema'
  const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, MAX_MESSAGE) : ''
  if (!message) return json({ error: 'message_required' }, 400)
  const screenUrl = typeof payload.screen_url === 'string' ? payload.screen_url : ''
  const screenLabel = typeof payload.screen_label === 'string' ? payload.screen_label : ''
  const correlationId = typeof payload.correlation_id === 'string' ? payload.correlation_id : ''

  try {
    // Deriva o usuário a partir do JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
    const requesterEmail = userData.user.email ?? ''

    // service_role: resolve profile + nome do tenant.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: profile } = await admin
      .from('profiles')
      .select('id, name, tenant_id')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle()

    const tenantId = (profile?.tenant_id as string | undefined) ?? undefined
    let tenantName = ''
    if (tenantId) {
      const { data: tenant } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle()
      tenantName = (tenant?.name as string | undefined) ?? ''
    }

    const authorName = (profile?.name as string | undefined) ?? 'Usuário'
    const typeLabel = TYPE_LABEL[type] ?? 'Chamado'
    const subject = `[Altech Suporte] ${typeLabel} — ${tenantName || 'workspace'}`

    const rows = [
      row('Tipo', escapeHtml(typeLabel)),
      row('Workspace', escapeHtml(tenantName || '—')),
      row('Aberto por', `${escapeHtml(authorName)}${requesterEmail ? ` &lt;${escapeHtml(requesterEmail)}&gt;` : ''}`),
      screenLabel || screenUrl
        ? row('Tela', escapeHtml(screenLabel || screenUrl) + (screenUrl ? ` — <a href="${escapeHtml(screenUrl)}">abrir</a>` : ''))
        : '',
      correlationId ? row('Código do erro', `<code>${escapeHtml(correlationId)}</code>`) : '',
      row('Aberto em', new Date().toLocaleString('pt-BR')),
    ].filter(Boolean).join('')

    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto">
        <h2 style="font-size:18px;color:#111;margin:0 0 12px">Novo chamado de suporte</h2>
        <table style="width:100%;border-collapse:collapse;background:#f6f7f9;border-radius:8px;overflow:hidden">${rows}</table>
        <p style="color:#5C5C7A;font-size:13px;margin:16px 0 6px">Descrição:</p>
        <div style="white-space:pre-wrap;color:#111;font-size:14px;line-height:1.6;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px">${escapeHtml(message)}</div>
        <p style="color:#9aa0ac;font-size:12px;margin-top:16px">Responda este e-mail para falar direto com quem abriu o chamado.</p>
      </div>`

    await sendEmail({
      to: SUPPORT_INBOX,
      subject,
      html,
      replyTo: requesterEmail || undefined,
      tenantId,
      templateKey: 'ticket_notification',
    })
  } catch (err) {
    console.error('notify-ticket: falhou', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'internal' }, 500)
  }

  return json({ ok: true })
})
