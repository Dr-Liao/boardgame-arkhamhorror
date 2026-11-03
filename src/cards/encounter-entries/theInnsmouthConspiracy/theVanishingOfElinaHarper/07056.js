import { scenarioReferenceEntry } from '../../_shared.js'

const harder = state => ['hard', 'expert'].includes(state.difficulty)
function doomOnNearest(state, inv, api, amount) {
  const candidates = api.nearestEnemies(inv, { fallback: true })
  if (!candidates.length) return
  const id = candidates.length === 1 ? candidates[0].id : api.choose({
    kind: 'enemy', source: '07056', seat: inv.seat, prompt: '选择最近的敌人放置毁灭。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
  })
  const enemy = candidates.find(enemy => enemy.id === id)
  if (enemy) api.doomOn(enemy, amount)
}
function placeClues(state, inv, api, amount) {
  if (!state.locations.some(loc => loc.id === inv.location)) return
  const moved = api.loseClues(inv.seat, Math.min(inv.clues || 0, amount))
  if (moved) api.addCluesToLocation(inv.location, moved)
}

export default scenarioReferenceEntry({
  code: '07056',
  scenarioRule: {
    resolveChaosToken(state, inv, token) {
      const hard = harder(state)
      const delta = token === 'skull'
        ? -(Number.parseInt(String(state.agendas[state.agendaIndex].stage), 10) + Number(hard))
        : { cultist: -2, tablet: -3, elderthing: -4 }[token]
      if (delta == null) return null
      return { delta, onDraw: [], onFail: !hard && token !== 'skull'
        ? [{ type: 'scenarioToken', event: token }] : [] }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'cultist') doomOnNearest(state, inv, api, 1)
      else if (effect.event === 'tablet') api.horror(inv.seat, 1)
      else if (effect.event === 'elderthing') placeClues(state, inv, api, 1)
    },
    afterTest(state, inv, result, api, context) {
      if (!harder(state) || context.ignoredSymbols) return
      // Occurrences stay separate: two resolved copies apply twice. Effects
      // replaced/cancelled by the token pipeline are absent from this ledger.
      for (const token of context.resolvedTokens) {
        if (token === 'cultist') doomOnNearest(state, inv, api, result.success ? 1 : 2)
        else if (token === 'tablet') {
          if (result.success) api.horror(inv.seat, 1)
          else api.harm(inv.seat, { damage: 1, horror: 1 })
        } else if (token === 'elderthing') placeClues(state, inv, api, result.success ? 1 : 2)
      }
    },
  },
})
