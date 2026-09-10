// Helper de envio de e-mail de PRODUTO via API do Resend.
// Use dentro de Edge Functions (não no cliente). Segredo: RESEND_API_KEY.
// Os e-mails de AUTH (confirmação/reset/convite) continuam pelo SMTP do Supabase — não usam este helper.
// tenant_id / template_key vão como "tags" para casar com as métricas em email_events (via webhook).

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Altech <no-reply@altechlab.com.br>'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  tenantId?: string
  templateKey?: string
  idempotencyKey?: string
}

export interface SendEmailResult {
  id: string
}

function tag(name: string, value: string) {
  // Resend aceita tags [a-zA-Z0-9_-]; sanitiza o valor por segurança.
  return { name, value: value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256) }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('sendEmail: RESEND_API_KEY ausente no ambiente')

  const tags: Array<{ name: string; value: string }> = []
  if (input.tenantId) tags.push(tag('tenant_id', input.tenantId))
  if (input.templateKey) tags.push(tag('template_key', input.templateKey))

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey

  const body = {
    from: input.from ?? DEFAULT_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    ...(tags.length ? { tags } : {}),
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`Resend ${res.status}: ${detail}`)
    }
    return (await res.json()) as SendEmailResult
  } catch (err) {
    console.error('sendEmail failed', { subject: input.subject, error: err instanceof Error ? err.message : 'unknown' })
    throw new Error(`sendEmail failed: ${err instanceof Error ? err.message : 'unknown'}`)
  }
}
