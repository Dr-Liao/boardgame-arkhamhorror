// 08712 极地幻景 · 所附地点发现或控制线索后，弃掉该调查员手中所有可弃置的非弱点与本卡。
import { cannotLeaveHand, entryDistance, isWeaknessCode } from '../../../_shared.js'
import { canAttachToLocation } from '../../../_shared.js'

const CODE = '08712'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  abilities: [{
    kind: 'forced', trigger: ['clueDiscovered', 'clueControlTaken'],
    label: '所附地点发现或控制线索后：弃掉手中非弱点牌和极地幻景',
    criteria: ({ state, source, context }) => context.amount > 0
      && state.locations.some(location => location.id === context.location
        && location.attachments?.some(attachment => attachment.id === source.id)),
    resolve: ({ state, source, context, api }) => {
      const owner = state.investigators[context.seat]
      for (const code of [...owner.hand].filter(code => !isWeaknessCode(code) && !cannotLeaveHand(code))) api.discardFromHand(owner.seat, code)
      api.discardAttachment(source)
    },
  }],
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(location => canAttachToLocation(location) && location.clues > 0
      && !location.attachments?.some(attachment => (attachment.originalCode || attachment.code) === CODE))
    const distance = Math.min(...candidates.map(location => entryDistance(state, inv.location, location.id)))
    if (!Number.isFinite(distance)) return false
    const nearest = candidates.filter(location => entryDistance(state, inv.location, location.id) === distance)
    const id = nearest.length === 1 ? nearest[0].id : api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近的有线索且没有附属极地幻景的地点。',
      options: nearest.map(location => ({ id: location.id, label: location.name })),
    })
    return !!api.attachEncounterToLocation(CODE, id)
  },
}
