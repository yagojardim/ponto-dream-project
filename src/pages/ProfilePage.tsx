import { useEffect, useState } from 'react'
import { useSession } from '@/data/SessionContext'
import { Avatar } from '@/components/ds/Avatar'
import { T } from '@/components/ds/tokens'
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { requestPasswordReset } from '@/lib/passwordReset'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin Master', pmo: 'PMO', pm: 'Gerente de Projeto', po: 'Product Owner',
  sm: 'Scrum Master', tech_lead: 'Tech Lead', dev: 'Desenvolvedor', ux: 'UX/UI',
  qa: 'QA', client: 'Cliente', finance: 'Financeiro', stakeholder: 'Stakeholder',
}

export default function ProfilePage() {
  const { activeUser, authUser } = useSession()
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const email = authUser?.email ?? activeUser.email
  const roleLabel = ROLE_LABEL[activeUser.role_context] ?? activeUser.role_context

  useEffect(() => {
    let alive = true
    setLoading(true)
    void (async () => {
      const name = await safeCall('profile.tenant', async () => {
        const { data } = await (supabase as unknown as { from: (t: string) => any })
          .from('tenants')
          .select('name')
          .eq('id', activeUser.tenant_id)
          .maybeSingle()
        return (data?.name as string | undefined) ?? null
      }, null)
      if (!alive) return
      setTenantName(name)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [activeUser.tenant_id])

  async function handleChangePassword() {
    if (!email) { setMsg({ kind: 'err', text: 'Não foi possível identificar seu e-mail.' }); return }
    setSending(true)
    setMsg(null)
    const res = await safeCall('profile.resetPassword', () => requestPasswordReset(email), { ok: false })
    setSending(false)
    setMsg(res.ok
      ? { kind: 'ok', text: 'Enviamos um link de redefinição para o seu e-mail. Verifique a caixa de entrada.' }
      : { kind: 'err', text: 'Não foi possível iniciar a troca de senha. Tente novamente.' })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="m-0 text-[20px] font-semibold" style={{ color: T.text1 }}>Meu perfil</h1>
        <p className="mt-1 mb-0 text-[12px]" style={{ color: T.text2 }}>
          Dados da sua conta. Para alterações de cadastro, fale com o administrador do tenant.
        </p>
      </header>

      <section
        data-tour="pf-data"
        className="rounded-2xl p-6"
        style={{ background: T.bgSurface, border: `1px solid ${T.border}`, boxShadow: T.shadow1 }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={activeUser.name} size="lg" />
          <div className="min-w-0">
            <p className="m-0 text-[16px] font-semibold truncate" style={{ color: T.text1 }}>{activeUser.name}</p>
            <span
              className="inline-block mt-1.5 text-[10px] font-bold px-2 py-px rounded-full"
              style={{ color: T.accent, background: T.accentDim }}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-xl" style={{ background: T.border }}>
          <Field label="Nome" value={activeUser.name} />
          <Field label="E-mail" value={email || '—'} />
          <Field label="Papel" value={roleLabel} />
          <Field label="Organização" value={loading ? 'Carregando…' : (tenantName ?? activeUser.tenant_id ?? '—')} />
        </div>
      </section>

      <section
        data-tour="pf-security"
        className="mt-4 rounded-2xl p-6"
        style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}
      >
        <h2 className="m-0 text-[14px] font-semibold" style={{ color: T.text1 }}>Segurança</h2>
        <p className="mt-1 mb-4 text-[12px]" style={{ color: T.text2 }}>
          Enviaremos um link seguro para você definir uma nova senha.
        </p>
        <button
          onClick={() => void handleChangePassword()}
          disabled={sending}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-opacity"
          style={{
            background: T.accent, color: '#fff',
            opacity: sending ? 0.6 : 1, cursor: sending ? 'default' : 'pointer',
          }}
        >
          {sending ? 'Enviando…' : 'Trocar senha'}
        </button>
        {msg && (
          <p
            className="mt-3 mb-0 text-[12px]"
            style={{ color: msg.kind === 'ok' ? T.success : T.crit }}
            role="status"
          >
            {msg.text}
          </p>
        )}
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ background: T.bgSurface2 }}>
      <span className="text-[12px]" style={{ color: T.text3 }}>{label}</span>
      <span className="text-[13px] font-medium truncate" style={{ color: T.text1 }}>{value}</span>
    </div>
  )
}
