/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — emite notificações na CENTRAL PRINCIPAL do app (sino do
// Header). NÃO há central separada: reusa src/data/db/notifications.ts, então as
// notificações do módulo aparecem junto com as demais, no mesmo sino do topo.
import { safeCall } from '@/utils/logger'
import * as notificationsApi from '@/data/db/notifications'
import { getMembers } from '@/data/db/members'

export type MeetingNotificationKind = 'request' | 'approved' | 'denied' | 'share' | 'usage' | 'module'

// Mapeia o tipo do Meeting para os tipos que a central principal conhece
// (o Header escolhe o ícone: approval ✅, comment 💬, info 🔔).
const KIND_TO_TYPE: Record<MeetingNotificationKind, string> = {
  approved: 'approval',
  request:  'info',
  denied:   'info',
  share:    'info',
  usage:    'info',
  module:   'info',
}

/**
 * Cria a notificação na central principal. `recipientId` = um profile (profiles.id);
 * `null` = todos os admins (tenant_owner) do tenant. Mantém a mesma assinatura de
 * antes, então os pontos que emitem (compartilhamento, cota) não mudam.
 */
export async function emitNotification(input: {
  recipientId: string | null
  kind: MeetingNotificationKind
  body: string
}): Promise<void> {
  await safeCall('meetingNotifications.emitNotification', async () => {
    const targets = input.recipientId
      ? [input.recipientId]
      : (await getMembers()).filter(m => m.tenant_owner).map(m => m.id)
    for (const profileId of targets) {
      await notificationsApi.create({
        profileId,
        type: KIND_TO_TYPE[input.kind],
        title: input.body,
        entityType: 'meeting',
        entityId: null,
      })
    }
    return null
  }, null)
}
