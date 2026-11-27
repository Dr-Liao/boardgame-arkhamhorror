// 08670 静电放电：地点上的封印和调查员控制的封印都能放电。
import { sealsOf } from '../../_shared.js'

const code = '08670'

export default {
  code, scope: 'treachery', implemented: true,
  treacheryRule: { surge: true },
  encounterResolve(state, inv, card, api) {
    const investigators = state.investigators.filter(target => !target.defeated && !target.resigned)
    const locations = new Map()
    for (const seal of sealsOf(state)) {
      const location = seal.locationId ?? investigators.find(owner => owner.seat === seal.placedBySeat)?.location
      if (location != null) locations.set(location, locations.get(location) === true || seal.active)
    }
    const remaining = investigators.filter(target => locations.has(target.location))
    while (remaining.length) {
      const seat = remaining.length === 1 ? remaining[0].seat : Number(api.choice({
        kind: 'investigator', source: code, seat: inv.seat,
        prompt: '选择下一位受到静电放电的调查员。',
        options: remaining.map(target => ({ id: String(target.seat), label: target.name })),
      }))
      const index = remaining.findIndex(target => target.seat === seat)
      if (index < 0) break
      const [target] = remaining.splice(index, 1)
      api.harm(target.seat, { damage: locations.get(target.location) ? 1 : 0, horror: 1 })
    }
    return false
  },
}
