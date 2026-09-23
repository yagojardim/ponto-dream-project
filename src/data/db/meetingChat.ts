// Meeting Intelligence — chat sobre a reunião (RAG). Fase 2, casca.
// Ao ligar CHAT_RAG_ENABLED + Claude, trocar o miolo por uma Edge Function que
// faz o RAG sobre o transcript (supabase.functions.invoke('meeting-chat', ...)).
import { safeCall } from '@/utils/logger'

export interface ChatTurn {
  role: 'user' | 'bot'
  text: string
}

/** Pergunta sobre a reunião. Casca até o motor de IA existir. */
export async function askMeeting(_meetingId: string, _question: string): Promise<string> {
  return safeCall('meetingChat.askMeeting', async () => {
    // Ponto de integração (quando CHAT_RAG_ENABLED): invocar a Edge Function de RAG.
    return 'O chat sobre a reunião fica disponível quando o motor de IA (Claude) for configurado.'
  }, 'Não foi possível responder agora.')
}
