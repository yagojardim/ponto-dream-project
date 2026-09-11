import { T } from '@/components/ds/tokens'

// Página PÚBLICA de Suporte (rota /suporte, sem login). Contato simples.

const SUPPORT_EMAIL = 'suporte@altechlab.com.br'

export default function SupportPage() {
  return (
    <div style={{ minHeight: '100vh', background: T.bgPage, color: T.text1, fontFamily: '-apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 72px' }}>
        {/* Marca */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.accent, fontWeight: 800 }}>A</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text1 }}>Altech <span style={{ color: T.accent }}>Project</span></span>
        </a>

        <h1 style={{ margin: '28px 0 8px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: T.text1 }}>Suporte</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: T.text2 }}>
          Precisa de ajuda com a Altech Project? A gente responde.
        </p>

        {/* Card de contato por e-mail */}
        <div style={{ marginTop: 28, padding: '22px 24px', borderRadius: 14, background: T.bgSurface, border: `1px solid ${T.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, color: T.text3 }}>Fale com o suporte</p>
          <p style={{ margin: '0 0 8px', fontSize: 13.5, lineHeight: 1.7, color: T.text2 }}>
            Escreva contando o que aconteceu, em qual tela e, se apareceu um <strong style={{ color: T.text1 }}>código do erro</strong>, inclua-o — assim resolvemos mais rápido.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontSize: 13.5, lineHeight: 1.7, color: T.accent, textDecoration: 'none' }}>{SUPPORT_EMAIL}</a>
        </div>

        {/* Dicas */}
        <div style={{ marginTop: 18, padding: '18px 24px', borderRadius: 14, background: T.bgSurface, border: `1px solid ${T.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: T.text1 }}>Antes de abrir um chamado</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: T.text2 }}>
            <li>Já com a conta? Você também pode reportar problemas direto na plataforma, em <strong style={{ color: T.text1 }}>Ajuda &amp; Suporte</strong>.</li>
            <li>Descreva o passo a passo para reproduzir o problema.</li>
            <li>Se puder, anexe uma captura de tela.</li>
          </ul>
        </div>

        <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/" style={{ display: 'inline-block', padding: '11px 22px', borderRadius: 10, background: T.accent, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Entrar na plataforma</a>
          <a href="/privacidade" style={{ display: 'inline-block', padding: '11px 22px', borderRadius: 10, background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Política de Privacidade</a>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.text3 }}>
          © 2026 Altech Project — Onde seus projetos ganham clareza.
        </div>
      </div>
    </div>
  )
}
