import type { ReactNode } from 'react'
import { T } from '@/components/ds/tokens'

// Página PÚBLICA de Política de Privacidade (rota /privacidade, sem login).
// Conteúdo alinhado à LGPD (Lei 13.709/2018) e a práticas de SaaS. Os campos
// entre [colchetes] devem ser preenchidos com os dados reais da empresa, e o
// texto deve passar por revisão jurídica antes de publicar.

const UPDATED_AT = '[DATA DE VIGÊNCIA]'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: T.text1, letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: T.text2 }}>{children}</div>
    </section>
  )
}

function LI({ children }: { children: ReactNode }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>
}

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: T.bgPage, color: T.text1, fontFamily: '-apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 72px' }}>
        {/* Marca */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.accent, fontWeight: 800 }}>A</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text1 }}>Altech <span style={{ color: T.accent }}>Project</span></span>
        </a>

        <h1 style={{ margin: '28px 0 6px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: T.text1 }}>Política de Privacidade</h1>
        <p style={{ margin: 0, fontSize: 13, color: T.text3 }}>Última atualização: {UPDATED_AT}</p>

        {/* Aviso de revisão jurídica (remover antes de publicar) */}
        <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10, background: T.warnDim, border: `1px solid ${T.warn}55`, fontSize: 12.5, lineHeight: 1.6, color: T.warn }}>
          <strong>Rascunho — recomendamos revisão jurídica antes de publicar.</strong> Os dados de identificação legal (razão social, CNPJ e Encarregado/DPO) serão incluídos assim que estiverem disponíveis.
        </div>

        <Section title="1. Quem somos">
          A <strong style={{ color: T.text1 }}>Altech Project</strong> ("Plataforma", "Serviço") é uma solução online de <strong style={{ color: T.text1 }}>gestão de projetos e times</strong>: ajuda equipes a organizar projetos, acompanhar demandas e manter tudo sob controle, com clareza. Esta Política de Privacidade descreve, de forma transparente, quais dados pessoais tratamos quando você usa o Serviço, com quais finalidades e quais são os seus direitos. Nosso princípio é coletar <strong style={{ color: T.text1 }}>apenas o necessário</strong> para operar a Plataforma. Ao usar o Serviço, você concorda com as práticas aqui descritas.
        </Section>

        <Section title="2. Dados que coletamos">
          <ul style={{ margin: '0', paddingLeft: 18 }}>
            <LI><strong style={{ color: T.text1 }}>Cadastro e conta:</strong> nome, e-mail, senha (armazenada de forma criptografada) e papel/perfil de acesso.</LI>
            <LI><strong style={{ color: T.text1 }}>Conteúdo inserido por você:</strong> projetos, tarefas, comentários, apontamentos de horas, anexos e demais informações que você e sua equipe registram na Plataforma.</LI>
            <LI><strong style={{ color: T.text1 }}>Dados técnicos e de uso:</strong> endereço IP, informações do dispositivo e navegador, registros de acesso e de erros (logs) e dados de cookies.</LI>
            <LI><strong style={{ color: T.text1 }}>Login por terceiros:</strong> se você optar por entrar com o Google, recebemos dados básicos do seu perfil (nome e e-mail) para autenticação.</LI>
          </ul>
        </Section>

        <Section title="3. Para que usamos e base legal (LGPD)">
          Tratamos dados para as finalidades abaixo, com as respectivas bases legais do art. 7º da LGPD:
          <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            <LI><strong style={{ color: T.text1 }}>Prestar e operar o Serviço</strong> — execução de contrato.</LI>
            <LI><strong style={{ color: T.text1 }}>Autenticação, segurança e prevenção a fraudes</strong> — legítimo interesse e cumprimento de obrigação legal.</LI>
            <LI><strong style={{ color: T.text1 }}>Comunicações transacionais</strong> (confirmação de conta, redefinição de senha, avisos do serviço) — execução de contrato.</LI>
            <LI><strong style={{ color: T.text1 }}>Melhoria do produto e suporte</strong> — legítimo interesse.</LI>
            <LI><strong style={{ color: T.text1 }}>Comunicações de marketing</strong>, quando aplicável — mediante seu consentimento, que pode ser revogado a qualquer momento.</LI>
          </ul>
        </Section>

        <Section title="4. Compartilhamento e subprocessadores">
          <strong style={{ color: T.text1 }}>Não vendemos seus dados.</strong> Compartilhamos dados apenas com prestadores que nos ajudam a operar o Serviço, sob obrigações de confidencialidade e segurança:
          <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            <LI>Infraestrutura, banco de dados e autenticação — <strong style={{ color: T.text1 }}>Supabase</strong>.</LI>
            <LI>Envio de e-mails transacionais — <strong style={{ color: T.text1 }}>Resend</strong>.</LI>
            <LI>Login social (opcional) — <strong style={{ color: T.text1 }}>Google</strong>.</LI>
            <LI>[Outros subprocessadores — preencher conforme o uso real].</LI>
          </ul>
          <p style={{ margin: '10px 0 0' }}>Também poderemos compartilhar dados quando exigido por lei, ordem judicial ou autoridade competente.</p>
        </Section>

        <Section title="5. Cookies e tecnologias similares">
          Utilizamos cookies e armazenamento local essenciais para autenticação, segurança e funcionamento da Plataforma, além de cookies para lembrar preferências. Você pode gerenciar cookies nas configurações do seu navegador; alguns recursos podem não funcionar sem os cookies essenciais.
        </Section>

        <Section title="6. Transferência internacional">
          Alguns subprocessadores podem tratar dados fora do Brasil (por exemplo, em servidores nos Estados Unidos). Nesses casos, adotamos salvaguardas adequadas, conforme exigido pela LGPD, para proteger seus dados.
        </Section>

        <Section title="7. Segurança">
          Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda ou alteração — incluindo criptografia de senhas, controle de acesso por perfil e isolamento de dados por organização (tenant). Nenhum sistema é 100% infalível; em caso de incidente relevante, seguiremos as obrigações legais de comunicação.
        </Section>

        <Section title="8. Retenção">
          Mantemos os dados enquanto sua conta estiver ativa e pelo tempo necessário para cumprir as finalidades desta Política e obrigações legais. Registros técnicos (logs) têm retenção reduzida (ex.: 60 dias). Após o encerramento, os dados são eliminados ou anonimizados, ressalvadas as hipóteses de guarda legal.
        </Section>

        <Section title="9. Seus direitos (LGPD)">
          Você pode, a qualquer momento, exercer os direitos do art. 18 da LGPD:
          <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            <LI>Confirmar a existência de tratamento e acessar seus dados;</LI>
            <LI>Corrigir dados incompletos, inexatos ou desatualizados;</LI>
            <LI>Solicitar anonimização, bloqueio ou eliminação;</LI>
            <LI>Solicitar a portabilidade;</LI>
            <LI>Revogar o consentimento e ser informado sobre compartilhamentos.</LI>
          </ul>
          <p style={{ margin: '10px 0 0' }}>Para exercê-los, escreva para <a href="mailto:suporte@altechlab.com.br" style={{ color: T.accent }}>suporte@altechlab.com.br</a>.</p>
        </Section>

        <Section title="10. Crianças e adolescentes">
          A Plataforma é destinada a uso profissional e não é direcionada a menores de 18 anos. Não coletamos intencionalmente dados de menores.
        </Section>

        <Section title="11. Contato para privacidade">
          Para exercer seus direitos ou tirar dúvidas sobre privacidade e proteção de dados, fale conosco pelo e-mail <a href="mailto:suporte@altechlab.com.br" style={{ color: T.accent }}>suporte@altechlab.com.br</a>. Responderemos no menor prazo possível. A indicação formal do Encarregado (DPO) será publicada aqui em breve.
        </Section>

        <Section title="12. Alterações desta Política">
          Podemos atualizar esta Política periodicamente. Alterações relevantes serão comunicadas pelos canais do Serviço. A data no topo indica a última atualização.
        </Section>

        <Section title="13. Contato">
          Dúvidas sobre privacidade: <a href="mailto:suporte@altechlab.com.br" style={{ color: T.accent }}>suporte@altechlab.com.br</a>.
        </Section>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.text3 }}>
          <a href="/" style={{ color: T.accent, textDecoration: 'none' }}>← Voltar para a Altech Project</a>
        </div>
      </div>
    </div>
  )
}
