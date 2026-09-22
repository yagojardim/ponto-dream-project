// meeting-summarize (Fatia 1B): gera o RESUMO estruturado de uma reunião via Claude
// e grava em meetings.summary (jsonb) + meeting_action_items. Chamada pelo FRONT
// AUTENTICADO; deriva o tenant do JWT e lê o transcript do banco (não confia no client).
//
// IMPORTANTE (@devops): verify_jwt = TRUE (já em supabase/config.toml).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
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

interface ActionItem { text: string; assignee: string | null; due: string | null }
interface Summary {
  objetivo: string
  assunto: string
  itens_discutidos: string[]
  decisoes: string[]
  pontos_definir: string[]
  proximos_passos: ActionItem[]
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') as string[] : []
}

async function summarize(apiKey: string, transcript: string): Promise<Summary> {
  const prompt = `Você é um assistente de gestão de projetos. Analise o transcript de reunião e responda SOMENTE com um JSON válido (sem texto fora do JSON), no formato exato:
{"objetivo":"1 frase","assunto":"1 frase","itens_discutidos":["..."],"decisoes":["..."],"pontos_definir":["..."],"proximos_passos":[{"text":"tarefa acionável","assignee":"nome citado ou null","due":"prazo citado ou null"}]}
Regras: escreva em português; proximos_passos devem ser tarefas concretas (viram issues no board); se algo não existir, use lista vazia. NÃO invente dados que não estão no transcript.

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
  const p = JSON.parse(clean)
  return {
    objetivo: typeof p.objetivo === 'string' ? p.objetivo : '',
    assunto: typeof p.assunto === 'string' ? p.assunto : '',
    itens_discutidos: strArr(p.itens_discutidos),
    decisoes: strArr(p.decisoes),
    pontos_definir: strArr(p.pontos_definir),
    proximos_passos: Array.isArray(p.proximos_passos)
      ? p.proximos_passos
          .filter((x: unknown) => x && typeof (x as { text?: unknown }).text === 'string')
          .map((x: { text: string; assignee?: unknown; due?: unknown }): ActionItem => ({
            text: String(x.text).slice(0, 500),
            assignee: typeof x.assignee === 'string' ? x.assignee : null,
            due: typeof x.due === 'string' ? x.due : null,
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

  let payload: { meeting_id?: unknown }
  try { payload = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const meetingId = typeof payload.meeting_id === 'string' ? payload.meeting_id : ''
  if (!meetingId) return json({ error: 'meeting_id_required' }, 400)

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

    // Lê a reunião (mesmo tenant) e pega o transcript do banco.
    const { data: meeting } = await admin
      .from('meetings').select('id, tenant_id, transcript').eq('id', meetingId).maybeSingle()
    if (!meeting || (meeting.tenant_id as string) !== tenantId) return json({ error: 'meeting_not_found' }, 404)
    const transcript = String(meeting.transcript ?? '').trim().slice(0, MAX_TRANSCRIPT)
    if (!transcript) return json({ error: 'transcript_required' }, 400)

    await admin.from('meetings').update({ status: 'processing' }).eq('id', meetingId)

    let summary: Summary
    try {
      summary = await summarize(apiKey, transcript)
    } catch (err) {
      await admin.from('meetings').update({ status: 'failed' }).eq('id', meetingId)
      console.error('meeting-summarize AI error', err instanceof Error ? err.message : 'unknown')
      return json({ error: 'ai_failed' }, 502)
    }

    // Grava o resumo (jsonb) na própria reunião.
    await admin.from('meetings')
      .update({ summary, status: 'ready' })
      .eq('id', meetingId)

    // Substitui os action items (idempotente em reprocessamento).
    await admin.from('meeting_action_items').delete().eq('meeting_id', meetingId)
    if (summary.proximos_passos.length) {
      await admin.from('meeting_action_items').insert(
        summary.proximos_passos.map((a) => ({
          meeting_id: meetingId, tenant_id: tenantId,
          text: a.text, assignee: a.assignee, due: a.due,
        })),
      )
    }

    return json({ ok: true, summary })
  } catch (err) {
    console.error('meeting-summarize failed', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'internal' }, 500)
  }
})
