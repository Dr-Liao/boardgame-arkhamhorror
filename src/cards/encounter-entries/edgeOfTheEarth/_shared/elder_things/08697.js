// 08697 古老者崛起 · 从遭遇弃牌堆召回古老者，并强化当前与你交战的古老者一轮。
import { ALL_CARDS } from '../../../_shared.js'

const isElderThing = code => ALL_CARDS[code]?.type === 'enemy'
  && ALL_CARDS[code].traits?.some(trait => trait.toLowerCase() === 'elder thing')

export default {
  code: '08697', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const code = (state.encounterDiscard || []).findLast(isElderThing)
    const taken = code && api.takeEncounterDiscard(code)
    const spawned = taken && api.spawnEngaged(code, inv.location, inv.seat, { ignoreSpawn: true })
    for (const enemy of state.enemies) {
      const engaged = enemy.engagedSeat === inv.seat || (enemy.massive && !enemy.exhausted && enemy.location === inv.location)
      if (engaged && isElderThing(enemy.originalCode || enemy.code)) api.addEnemyStatModifier(enemy, { fight: 1, evade: 1 }, { until: 'endOfRound' })
    }
    return spawned ? false : { gainSurge: true }
  },
}
