// Redação de PII / segredos antes de gravar em support_logs (LGPD).
// Regra: mascara por NOME de campo (chaves sensíveis) e por FORMATO de valor
// (e-mail, CPF/CNPJ, tokens/JWT longos). Limita profundidade e tamanho para
// não gravar payloads gigantes. Usado nas Edge Functions (Deno), não no cliente.

export const MASK = '[redacted]'

const MAX_DEPTH = 6
const MAX_KEYS = 60
const MAX_ARRAY = 40
const MAX_STRING = 2000

// Chaves cujo valor é sempre mascarado (case-insensitive, por substring).
const SENSITIVE_KEYS = [
  'password', 'senha', 'secret', 'token', 'authorization', 'auth',
  'apikey', 'api_key', 'access_token', 'refresh_token', 'session',
  'cookie', 'cpf', 'cnpj', 'rg', 'card', 'cartao', 'credit', 'cvv', 'cvc',
]

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
// CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx), com ou sem separadores.
const CPF_CNPJ_RE = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g
// JWT ou token opaco longo (>=40 chars base64/url-safe contínuos).
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{40,}\b/g

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase()
  return SENSITIVE_KEYS.some((s) => k.includes(s))
}

function redactString(value: string): string {
  const clipped = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[+${value.length - MAX_STRING}]` : value
  return clipped
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(CPF_CNPJ_RE, '[redacted-doc]')
    .replace(LONG_TOKEN_RE, '[redacted-token]')
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth >= MAX_DEPTH) return MASK

  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY).map((v) => redactValue(v, depth + 1))
    if (value.length > MAX_ARRAY) out.push(`…[+${value.length - MAX_ARRAY} itens]`)
    return out
  }

  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    let count = 0
    for (const key of Object.keys(src)) {
      if (count >= MAX_KEYS) { out['…'] = `[+${Object.keys(src).length - MAX_KEYS} campos]`; break }
      count++
      out[key] = isSensitiveKey(key) ? MASK : redactValue(src[key], depth + 1)
    }
    return out
  }

  // Funções, símbolos, bigint etc. não são serializáveis com segurança.
  return MASK
}

/**
 * Redige um contexto arbitrário. Sempre retorna um objeto seguro para gravar em jsonb.
 * Entradas que não são objeto viram `{ value: <redigido> }`.
 */
export function redactContext(input: unknown): Record<string, unknown> {
  const redacted = redactValue(input, 0)
  if (redacted && typeof redacted === 'object' && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>
  }
  return { value: redacted }
}
