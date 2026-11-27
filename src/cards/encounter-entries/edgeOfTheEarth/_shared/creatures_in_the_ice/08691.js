// 08691 同源迷雾 · 附属到最近的无同名附属地点。
import { entryDistance } from '../../../_shared.js'
import { canAttachToLocation } from '../../../_shared.js'

const CODE = '08691'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { tekeliShuffleToBottom: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(location => canAttachToLocation(location)
      && !location.attachments?.some(attachment => (attachment.originalCode || attachment.code) === CODE))
    const distance = Math.min(...candidates.map(location => entryDistance(state, inv.location, location.id)))
    if (!Number.isFinite(distance)) return false
    const nearest = candidates.filter(location => entryDistance(state, inv.location, location.id) === distance)
    const id = nearest.length === 1 ? nearest[0].id : api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属本卡的地点。',
      options: nearest.map(location => ({ id: location.id, label: location.name })),
    })
    return !!api.attachEncounterToLocation(CODE, id)
  },
}
