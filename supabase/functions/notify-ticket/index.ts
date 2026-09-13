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
const LOGO = 'https://edjbajhaqtqqkvqikxcx.supabase.co/storage/v1/object/public/email-assets/altech-logo.png'

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
    <td style="padding:8px 0;border-bottom:1px solid #EBEEF3;color:#7A869A;font-size:13px;vertical-align:top;white-space:nowrap;">${label}</td>
    <td align="right" style="padding:8px 0;border-bottom:1px solid #EBEEF3;color:#172B4D;font-size:13px;font-weight:600;">${value}</td>
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
        ? row('Tela', escapeHtml(screenLabel || screenUrl))
        : '',
      correlationId ? row('Código do erro', `<code>${escapeHtml(correlationId)}</code>`) : '',
      row('Aberto em', new Date().toLocaleString('pt-BR')),
    ].filter(Boolean).join('')

    const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FC;margin:0;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #EBEEF3;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:30px 34px 22px;border-bottom:1px solid #EBEEF3;text-align:center;">
        <img src="${LOGO}" alt="Altech Lab" width="180" style="width:180px;max-width:180px;height:auto;border:0;outline:none;display:block;margin:0 auto;">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7A869A;margin-top:10px;">Gestão de projetos com clareza</div>
      </td></tr>
      <tr><td style="padding:28px 30px 8px;">
        <span style="display:inline-block;font-size:11px;font-weight:700;color:#2563EB;background:#EEF4FF;border-radius:99px;padding:4px 11px;">${escapeHtml(typeLabel)}</span>
        <h1 style="margin:12px 0 4px;font-size:22px;color:#172B4D;font-weight:800;letter-spacing:-0.01em;">Novo chamado de suporte</h1>
        <p style="margin:0 0 18px;font-size:13px;color:#7A869A;">de ${escapeHtml(authorName)}${requesterEmail ? ` · ${escapeHtml(requesterEmail)}` : ''}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FC;border:1px solid #EBEEF3;border-radius:12px;"><tr><td style="padding:4px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr></table>
        <p style="margin:18px 0 6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#7A869A;">Descrição</p>
        <div style="white-space:pre-wrap;color:#172B4D;font-size:14px;line-height:1.6;background:#FFFFFF;border:1px solid #EBEEF3;border-radius:12px;padding:14px;">${escapeHtml(message)}</div>
      </td></tr>
      <tr><td style="padding:18px 30px 24px;border-top:1px solid #EBEEF3;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#7A869A;">Responda este e-mail para falar direto com quem abriu o chamado.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`

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
