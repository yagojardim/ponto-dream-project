// meeting-summarize: recebe um transcript de reunião e gera, via Claude,
// resumo + decisões + action items — grava em meeting_summaries / meeting_action_items.
// Chamada pelo FRONT AUTENTICADO (ou pelo pipeline do bot). Deriva tenant do JWT.
//
// IMPORTANTE (@devops): verify_jwt = TRUE (declarar em supabase/config.toml).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
// Gated pelo módulo premium mod_meeting_intel (checar no front; opcional checar aqui).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const MODEL = 'claude-sonnet-5'
const MAX_TRANSCRIPT = 120000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface AiResult {
  summary: string
  decisions: string[]
  action_items: { text: string; assignee?: string | null; due_hint?: string | null }[]
}

async function summarize(apiKey: string, transcript: string): Promise<AiResult> {
  const prompt = `Você é um assistente de gestão de projetos. Analise o transcript de reunião abaixo e responda SOMENTE com um JSON válido, sem texto fora do JSON, no formato:
{"summary": "resumo executivo em português (2-5 frases)", "decisions": ["decisão 1", "..."], "action_items": [{"text": "tarefa acionável", "assignee": "nome citado ou null", "due_hint": "prazo citado ou null"}]}
Regras: action_items devem ser tarefas concretas e acionáveis (para virar issues). Se não houver, use listas vazias.

TRANSCRIPT:
${transcript}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(clean)
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter((x: unknown) => typeof x === 'string') : [],
    action_items: Array.isArray(parsed.action_items)
      ? parsed.action_items.filter((x: unknown) => x && typeof (x as { text?: unknown }).text === 'string')
        .map((x: { text: string; assignee?: unknown; due_hint?: unknown }) => ({
          text: String(x.text).slice(0, 500),
          assignee: typeof x.assignee === 'string' ? x.assignee : null,
          due_hint: typeof x.due_hint === 'string' ? x.due_hint : null,
        }))
      : [],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing_authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'server_misconfigured' }, 500)
  if (!apiKey) return json({ error: 'ai_not_configured' }, 500)

  let payload: { meeting_id?: unknown; transcript?: unknown }
  try { payload = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const meetingId = typeof payload.meeting_id === 'string' ? payload.meeting_id : ''
  const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim().slice(0, MAX_TRANSCRIPT) : ''
  if (!meetingId) return json({ error: 'meeting_id_required' }, 400)
  if (!transcript) return json({ error: 'transcript_required' }, 400)

  try {
    // Deriva o usuário/tenant do JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: profile } = await admin
      .from('profiles').select('tenant_id').eq('auth_user_id', userData.user.id).maybeSingle()
    const tenantId = (profile?.tenant_id as string | undefined) ?? null
    if (!tenantId) return json({ error: 'no_tenant' }, 403)

    // A reunião precisa ser do mesmo tenant.
    const { data: meeting } = await admin
      .from('meetings').select('id, tenant_id').eq('id', meetingId).maybeSingle()
    if (!meeting || (meeting.tenant_id as string) !== tenantId) return json({ error: 'meeting_not_found' }, 404)

    await admin.from('meetings').update({ status: 'processing' }).eq('id', meetingId)

    const ai = await summarize(apiKey, transcript)

    await admin.from('meeting_summaries').insert({
      meeting_id: meetingId, tenant_id: tenantId,
      summary: ai.summary, decisions: ai.decisions, model: MODEL,
    })
    if (ai.action_items.length) {
      await admin.from('meeting_action_items').insert(
        ai.action_items.map((a) => ({
          meeting_id: meetingId, tenant_id: tenantId,
          text: a.text, assignee: a.assignee, due_hint: a.due_hint,
        })),
      )
    }
    await admin.from('meetings').update({ status: 'ready' }).eq('id', meetingId)

    return json({ ok: true, summary: ai.summary, decisions: ai.decisions, action_items: ai.action_items })
  } catch (err) {
    console.error('meeting-summarize failed', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'internal' }, 500)
  }
})
