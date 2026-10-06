// Porta de entrada do Portal do Cliente para sessões REAIS (status 'portal').
// A senha já foi validada pelo Supabase Auth; aqui resolvemos QUAIS acessos de
// portal pertencem a esse usuário (Edge Function client-portal-login, pelo JWT)
// e só então montamos a sessão do portal e abrimos o ClientPortalPage.
import { useEffect, useState } from 'react'
import { T } from '../components/ds/tokens'
import ClientPortalPage from './ClientPortalPage'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { portalLogin } from '../data/db/clientPortal'
import { clearPortalSession, savePortalSession } from '../lib/portalSession'

interface Props {
  /** Encerra a sessão (Supabase Auth + sessão do portal) e volta ao login do portal. */
  onLogout: () => void
}

type Phase = 'checking' | 'ready' | 'denied' | 'unavailable'

export default function PortalGate({ onLogout }: Props) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [mustChangePwd, setMustChangePwd] = useState(false)

  useEffect(() => {
    let alive = true
    void portalLogin().then(res => {
      if (!alive) return
      if (res.ok && res.user) {
        savePortalSession({
          id: res.user.id, name: res.user.name, email: res.user.email, tenantId: res.user.tenantId,
        })
        setMustChangePwd(res.user.mustChangePassword)
        setPhase('ready')
        return
      }
      clearPortalSession()
      setPhase(res.error === 'unavailable' || res.error === 'server_error' ? 'unavailable' : 'denied')
    })
    return () => { alive = false }
  }, [])

  if (phase === 'ready') {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: '#0e1016' }}>
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary scope="ClientPortal">
            <ClientPortalPage
              mustChangePassword={mustChangePwd}
              onPasswordChanged={() => setMustChangePwd(false)}
              onLogout={onLogout}
            />
          </ErrorBoundary>
        </div>
      </div>
    )
  }

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 420, background: T.bgSurface, border: `1px solid ${T.border}`,
    borderRadius: 14, padding: 28, textAlign: 'center',
  }
  const btn: React.CSSProperties = {
    height: 40, padding: '0 18px', borderRadius: 8, border: `1px solid ${T.border2}`,
    background: 'transparent', color: T.text2, fontSize: 13, cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={card} role="status" aria-live="polite">
        {phase === 'checking' && (
          <div style={{ color: T.text3, fontSize: 13 }}>Verificando seu acesso ao portal…</div>
        )}
        {phase === 'denied' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text1, margin: '0 0 8px' }}>Sem acesso ao portal</h1>
            <p style={{ fontSize: 13, color: T.text3, margin: '0 0 20px', lineHeight: 1.6 }}>
              Esta conta não tem nenhum Dash View liberado. Peça ao responsável do seu projeto para conceder o acesso.
            </p>
            <button type="button" onClick={onLogout} style={btn}>Sair</button>
          </>
        )}
        {phase === 'unavailable' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text1, margin: '0 0 8px' }}>Não foi possível verificar o acesso</h1>
            <p style={{ fontSize: 13, color: T.text3, margin: '0 0 20px', lineHeight: 1.6 }}>
              O serviço está indisponível agora. Tente novamente em instantes.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button type="button" onClick={() => window.location.reload()} style={btn}>Tentar novamente</button>
              <button type="button" onClick={onLogout} style={btn}>Sair</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
