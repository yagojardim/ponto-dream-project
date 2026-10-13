/* eslint-disable @typescript-eslint/no-explicit-any */
// Aparência do Início: leitura e gravação no banco, sem tabela nova.
// Pessoa: profiles.metadata.appearance · Empresa: tenant_settings.metadata.appearance.
// Gravar a escolha da empresa é só do Admin (RLS tenant_settings_admin_*).
import { supabase } from '@/integrations/supabase/client'
import { getActiveTenantId } from '@/data/session'
import { logger } from '@/utils/logger'
import {
  normalizeAppearance, normalizeCompany,
  type Appearance, type CompanyAppearance,
} from '@/data/appearance'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

/** Mensagem legível de erro (o Supabase devolve objetos com "message", não Error). */
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'erro desconhecido'
}

export interface AppearanceState {
  personal: Appearance | null
  company: CompanyAppearance | null
}

export async function fetchAppearance(profileId: string): Promise<AppearanceState> {
  try {
    const tid = getActiveTenantId()
    const [prof, ts] = await Promise.all([
      tbl('profiles').select('metadata').eq('id', profileId).eq('tenant_id', tid).maybeSingle(),
      tbl('tenant_settings').select('metadata').eq('tenant_id', tid).maybeSingle(),
    ])
    if (prof.error) throw prof.error
    if (ts.error) throw ts.error
    return {
      personal: normalizeAppearance(prof.data?.metadata?.appearance),
      company: normalizeCompany(ts.data?.metadata?.appearance),
    }
  } catch (err) {
    logger.error('appearance.fetch', err, { profileId })
    return { personal: null, company: null }
  }
}

/** Grava a escolha da pessoa, preservando o resto do metadata do perfil. */
export async function savePersonalAppearance(profileId: string, ap: Appearance): Promise<void> {
  const tid = getActiveTenantId()
  try {
    const { data, error } = await tbl('profiles').select('metadata').eq('id', profileId).eq('tenant_id', tid).maybeSingle()
    if (error) throw error
    const metadata = { ...(data?.metadata ?? {}), appearance: { ...ap } }
    const res = await tbl('profiles').update({ metadata }).eq('id', profileId).eq('tenant_id', tid)
    if (res.error) throw res.error
  } catch (err) {
    logger.error('appearance.savePersonal', err, { profileId })
    throw new Error(`Não foi possível salvar a sua aparência: ${errMsg(err)}`)
  }
}

/** Grava a escolha da empresa (só Admin), preservando o resto do metadata do tenant. */
export async function saveCompanyAppearance(company: CompanyAppearance): Promise<void> {
  const tid = getActiveTenantId()
  try {
    const { data, error } = await tbl('tenant_settings').select('metadata').eq('tenant_id', tid).maybeSingle()
    if (error) throw error
    const metadata = { ...(data?.metadata ?? {}), appearance: { ...company } }
    const res = await tbl('tenant_settings').upsert({ tenant_id: tid, metadata }, { onConflict: 'tenant_id' })
    if (res.error) throw res.error
  } catch (err) {
    logger.error('appearance.saveCompany', err)
    throw new Error(`Não foi possível salvar a aparência da empresa: ${errMsg(err)}`)
  }
}
