import { T } from '../ds/tokens'
import { Modal } from '../ds/Modal'
import { useOnboarding } from '@/hooks/useOnboarding'

const STEPS: { view: string; label: string; hint: string }[] = [
  { view: 'team', label: 'Cadastrar usuários', hint: 'Convide o time e defina papéis' },
  { view: 'projects-list', label: 'Criar projeto', hint: 'Descrição, período e equipe' },
  { view: 'boards-list', label: 'Criar board', hint: 'Seu quadro Kanban de trabalho' },
  { view: 'tenant-settings', label: 'Config. do tenant', hint: 'Identidade e Admin Master' },
  { view: 'modules', label: 'Módulos', hint: 'Ative recursos premium' },
]

export function WelcomeModal({ onNav }: { onNav: (view: string) => void }) {
  const { loaded, welcomeDone, markWelcomeDone, disableGuide } = useOnboarding()

  if (!loaded || welcomeDone) return null

  return (
    <Modal
      open
      onClose={markWelcomeDone}
      title="Bem-vindo à Altech Project 👋"
      subtitle="Um tour rápido para você começar pelo caminho certo."
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <button
            onClick={() => { disableGuide(); markWelcomeDone() }}
            className="h-9 px-4 rounded-lg text-[13px] font-medium"
            style={{ background: 'transparent', color: T.text2, border: `1px solid ${T.border}` }}
          >
            Pular e não mostrar dicas
          </button>
          <button
            onClick={markWelcomeDone}
            className="h-9 px-5 rounded-lg text-[13px] font-semibold"
            style={{ background: T.accent, color: '#fff' }}
          >
            Começar
          </button>
        </>
      }
    >
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="m-0 text-[13px]" style={{ color: T.text2 }}>
          Aqui você planeja, executa e acompanha os projetos do time. Em cada tela aparece uma dica
          rápida na primeira visita — e você pode reabri-la pelo “?”.
        </p>

        <div>
          <p className="m-0 mb-2 text-[12px] font-semibold" style={{ color: T.text1 }}>Primeiros passos</p>
          <div className="flex flex-col gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.view}
                onClick={() => { markWelcomeDone(); onNav(s.view) }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                style={{ background: T.bgSurface2, border: `1px solid ${T.border}` }}
              >
                <span
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}
                >{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium" style={{ color: T.text1 }}>{s.label}</span>
                  <span className="block text-[11px]" style={{ color: T.text3 }}>{s.hint}</span>
                </span>
                <span className="text-[13px]" style={{ color: T.text3 }}>→</span>
              </button>
            ))}
          </div>
        </div>

        <p className="m-0 text-[11px]" style={{ color: T.text3 }}>
          Você pode tirar dúvidas quando quiser em Feedback &amp; Suporte › Central de Ajuda.
        </p>
      </div>
    </Modal>
  )
}

export default WelcomeModal
