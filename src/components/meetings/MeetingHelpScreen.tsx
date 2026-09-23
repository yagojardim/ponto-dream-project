// Meeting Intelligence — Ajuda do módulo (mockup renderHelp). Seções adaptadas
// às capacidades ligadas (flags), para não documentar o que ainda está oculto.
import type { ReactNode } from 'react'
import { T } from '@/components/ds/tokens'
import { pageStyle, cardStyle } from '@/components/meetings/meetingUi'
import { IcSpark, IcStar, IcShield } from '@/components/meetings/icons'
import { MEETING_FLAGS } from '@/config/meetingFlags'

interface Props { isAdmin: boolean; onBack: () => void }

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 600, color: T.text1 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: T.indigoDim, border: `1px solid ${T.accentBorder}`, color: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcSpark size={14} /></span>
        {title}
      </div>
      {children}
    </div>
  )
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((x, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text1 }}>{x}</li>)}
    </ul>
  )
}

export function MeetingHelpScreen({ isAdmin, onBack }: Props) {
  return (
    <div style={pageStyle}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14, fontFamily: 'inherit' }}>‹ Reuniões</button>
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>Ajuda — Meeting Intelligence</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6, color: T.text2 }}>O que o módulo oferece na sua visão.</p>
        </div>

        <Card title="O que é o Meeting Intelligence?">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: T.text1 }}>
            Traz suas reuniões para dentro do Altech Project: recebe a transcrição (colada{MEETING_FLAGS.RECORDING_ENABLED ? ' ou gravada' : ''}),
            gera <b>resumo, decisões e próximos passos</b>, e transforma cada reunião em material para o seu discovery e a abertura de novas demandas.
          </p>
        </Card>

        <Card title="Telas e botões">
          <Bullets items={[
            <><b>Lista de reuniões</b> — todas as reuniões, com projeto, data e status. Filtros Todas / Processando / Prontas e busca.</>,
            <><b>Resumo</b> — a ata gerada (objetivo, assunto, itens, decisões, pontos a definir, próximos passos). Botão <b>Copiar ata</b>.</>,
            ...(MEETING_FLAGS.NOTES_ENABLED ? [<><b>Notas</b> — apontamentos da equipe, com âncora de tempo opcional. Não alteram a transcrição.</>] : []),
            <><b>Transcrição</b> — o texto da reunião; <b>Copiar</b> exporta o conteúdo.</>,
            ...(MEETING_FLAGS.SHARING_ENABLED ? [<><b>Compartilhar</b> — só o <b>dono</b> compartilha; quem recebe não consome cota. As bolinhas mostram com quem a reunião está compartilhada.</>] : []),
            <><b>Arquivar</b> — não exclui: tira da lista, mas fica <b>30 dias</b> no repositório antes da purga.</>,
          ]} />
        </Card>

        {MEETING_FLAGS.RECORDING_ENABLED && (
          <Card title="Como gravar uma reunião">
            <Bullets items={[
              'Entre na reunião normalmente (Teams, Zoom, Meet) ou reúna os participantes (presencial).',
              'Avise os participantes que a reunião será transcrita — transparência e boa prática de LGPD.',
              'Abra o módulo e use Nova reunião → Gravar agora.',
              'Autorize a captação de áudio na primeira vez (fica salva).',
              'Ao terminar, clique em Encerrar e depois em Iniciar transcrição.',
            ]} />
          </Card>
        )}

        {MEETING_FLAGS.HOURS_QUOTA_ENABLED && (
          <Card title="Suas horas, cota e notificações">
            <Bullets items={[
              <><b>Suas horas</b> (velocímetro no topo da lista): quanto você já usou da cota do seu cargo. Fica amarelo em 80% e vermelho em 100%.</>,
              <><b>Solicitar mais horas</b>: pedido temporário ou definitivo, com justificativa, enviado à administração.</>,
              <><b>Limite suave</b>: ao atingir 100% você não é cortado no meio de uma gravação — a administração é avisada.</>,
              <><b>Notificações</b> (sino): avisam quando o módulo é liberado, quando horas são aprovadas e quando algo é compartilhado com você.</>,
            ]} />
          </Card>
        )}

        {MEETING_FLAGS.HOURS_QUOTA_ENABLED && isAdmin && (
          <Card title="Gestão do módulo (administrador)">
            <Bullets items={[
              <><b>Consumo do mês</b>: horas usadas do pool do workspace, com KPIs (contratadas, usadas, restantes).</>,
              <><b>Solicitações de horas</b>: aprovar (concedendo mais ou menos que o pedido) ou negar (com motivo).</>,
              <><b>Cota por usuário</b>: tabela com consumo de cada usuário, ordenada por quem está mais perto do limite.</>,
              <><b>Liberar acesso</b>: inclui usuários que ainda não têm o módulo — cada um recebe a cota padrão do cargo.</>,
              ...(MEETING_FLAGS.BILLING_ENABLED ? [<><b>Contratar mais horas</b>: aumenta o pool do workspace; pagamento via Pix ou cartão. Só administradores contratam.</>] : []),
              'Cotas padrão: gestão (PMO, PM, PO, SM) 3h; execução (Tech Lead, Dev, UX, QA) 1h30.',
            ]} />
          </Card>
        )}

        <Card title="Consentimento e boas práticas">
          <Bullets items={[
            'O consentimento do módulo (LGPD) é registrado uma vez, por workspace, na contratação.',
            'Avise sempre os participantes antes de gravar.',
            'Revise o resumo antes de usar: ele é gerado por IA.',
          ]} />
        </Card>

        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text3 }}>
          <span style={{ color: T.warn, display: 'inline-flex' }}><IcStar /></span>
          Módulo premium — ativo para este workspace.
          <span style={{ color: T.text3, display: 'inline-flex', marginLeft: 6 }}><IcShield /></span>
        </p>
      </div>
    </div>
  )
}
