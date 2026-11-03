import { scenarioReferenceEntry } from '../../_shared.js'

const harder = state => ['hard', 'expert'].includes(state.difficulty)

export default scenarioReferenceEntry({
  code: '07163',
  scenarioRule: {
    trackTestTarget: true,
    resolveChaosToken(state, inv, token, api) {
      const hard = harder(state)
      const delta = token === 'skull' ? -(api.mechanics.keys.heldByGroup().length + Number(hard))
        : { cultist: hard ? -3 : -2, tablet: hard ? -4 : -3, elderthing: hard ? -5 : -4 }[token]
      if (delta == null) return null
      const effects = token === 'skull' ? [] : [{ type: 'scenarioToken', event: token }]
      return { delta, onDraw: hard ? effects : [], onFail: hard ? [] : effects }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'cultist') {
        const test = effect.test
        if (!['fight', 'evade'].includes(test?.actionKind) || test.target?.kind !== 'enemy') return
        const enemy = state.enemies.find(card => card.id === test.target.id
          && card.traits?.some(trait => String(trait).toLowerCase() === 'deep one'))
        if (!enemy) return
        if (enemy.location === inv.location) api.reengageEnemy(enemy, inv.seat)
        else api.engageAtInvestigator(enemy, inv.seat)
      } else if (effect.event === 'tablet') {
        if (!api.mechanics.vehicles.of(inv.seat)) api.damage(inv.seat, 1)
      } else if (effect.event === 'elderthing') {
        if (api.mechanics.keys.at(`location:${inv.location}`, { reveal: true }).length) api.horror(inv.seat, 1)
      }
    },
  },
})
