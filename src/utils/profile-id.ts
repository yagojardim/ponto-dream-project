// No login real, MockUser.user_id é o próprio profiles.id (UUID). Usá-lo evita
// procurar o perfil pelo NOME, que falha com nome repetido, renomeado ou com
// espaços diferentes (e a falha vira "perfil não encontrado").
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isProfileUuid(id: string | null | undefined): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

/** profiles.id do usuário da sessão: o próprio user_id (UUID) ou, nas personas
 *  de teste, o resultado da busca por nome. */
export async function resolveSessionProfileId(
  user: { user_id: string; name: string },
  byName: (name: string) => Promise<string | null>,
): Promise<string | null> {
  return isProfileUuid(user.user_id) ? user.user_id : byName(user.name)
}
