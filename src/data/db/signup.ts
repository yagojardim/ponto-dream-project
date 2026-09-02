// Auto-cadastro (Tela 1): cria tenant + Admin Master via Edge Function
// `signup-tenant` (service_role, atômica) e, em sucesso, autentica o usuário.
// Nenhum documento fiscal é capturado aqui (decisão de produto).
import { supabase } from '@/integrations/supabase/client'
import { signIn } from '@/lib/auth'
import { logger } from '@/utils/logger'

export interface SignupInput {
  name: string
  email: string
  password: string
  orgName: string
}

export type SignupResult =
  | { ok: true }
  | { ok: false; reason: 'email_exists' | 'error'; message?: string }

/**
 * Fluxo:
 * 1. Invoca a Edge Function `signup-tenant` (cria auth user + tenant + profile Admin Master).
 * 2. Em sucesso, faz login para estabelecer a sessão (SessionContext libera o app).
 * 3. E-mail já cadastrado → reason 'email_exists' (a UI redireciona para o Login).
 */
export async function signUpTenant(input: SignupInput): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase()
  try {
    const { data, error } = await supabase.functions.invoke('signup-tenant', {
      body: { name: input.name.trim(), email, password: input.password, orgName: input.orgName.trim() },
    })

    if (error) {
      logger.error('signup.invoke', error, { email })
      return { ok: false, reason: 'error', message: 'Não foi possível criar a conta agora. Tente novamente.' }
    }

    const res = data as { ok?: boolean; error?: string } | null
    if (res && res.ok === false) {
      if (res.error === 'email_exists') return { ok: false, reason: 'email_exists' }
      return { ok: false, reason: 'error', message: 'Não foi possível criar a conta. Verifique os dados.' }
    }

    const signedIn = await signIn(email, input.password)
    if (!signedIn.ok) {
      return { ok: false, reason: 'error', message: 'Conta criada, mas não foi possível entrar. Faça login.' }
    }
    return { ok: true }
  } catch (err) {
    logger.error('signup.signUpTenant', err, { email })
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erro inesperado ao criar a conta.' }
  }
}
