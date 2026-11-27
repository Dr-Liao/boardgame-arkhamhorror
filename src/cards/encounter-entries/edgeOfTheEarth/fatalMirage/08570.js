// 08570 医务室
import { partnerShroud } from './_shared.js'

export default {
  code: '08570', scope: 'location', implemented: true,
  flags: { mirageId: 'infirmaryFatalMirage', tier: 2 },
  locationRule: { shroudModifier: partnerShroud('08590', '08717') },
  abilities: [{
    kind: 'forced', trigger: 'move', label: '首次进入：生命余量超过 6 时降至 6，否则受到 1 伤害',
    limit: { scope: 'perGame', owner: 'investigator' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.location === source.id,
    resolve: ({ inv, api }) => {
      const remaining = () => api.maxHealth(inv.seat) - (inv.damage || 0)
      if (remaining() <= 6) return api.damage(inv.seat, 1)
      const placed = () => [inv.damage || 0, ...inv.assets.map(card => card.id + ':' + (card.damage || 0))].join('|')
      while (!inv.defeated && remaining() > 6) {
        const before = placed()
        api.damage(inv.seat, 1)
        if (placed() === before) break
      }
    },
  }],
}
