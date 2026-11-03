import { scenarioReferenceEntry } from '../../_shared.js'

const harder = state => ['hard', 'expert'].includes(state.difficulty)

export default scenarioReferenceEntry({
  code: '07231',
  scenarioRule: {
    resolveChaosToken(state, inv, token, api) {
      const hard = harder(state)
      const delta = { skull: hard ? -2 : -1, cultist: -2, tablet: -3, elderthing: -4 }[token]
      if (delta == null) return null
      return {
        delta,
        drawAnother: token === 'skull' && api.mechanics.water.effectiveLevel(inv.seat) > 0,
        onDraw: hard && token === 'elderthing' ? [{ type: 'scenarioToken', event: 'moveEnemy', readyOnly: false }] : [],
        onFail: token === 'tablet' ? [{ type: 'scenarioToken', event: 'damage', amount: hard ? 2 : 1 }]
          : !hard && token === 'elderthing' ? [{ type: 'scenarioToken', event: 'moveEnemy', readyOnly: true }] : [],
      }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'damage') {
        if (api.mechanics.water.effectiveLevel(inv.seat) > 0) api.damage(inv.seat, effect.amount)
      } else if (effect.event === 'moveEnemy') {
        if (!state.locations.some(loc => loc.id === inv.location)) return
        const candidates = api.nearestEnemies(inv, {
          predicate: enemy => api.isEnemyUnengaged(enemy) && (!effect.readyOnly || !enemy.exhausted),
        })
        if (!candidates.length) return
        const id = candidates.length === 1 ? candidates[0].id : api.choose({
          kind: 'enemy', seat: inv.seat, source: '07231', prompt: '选择最近的未交战敌人移动。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
        })
        const enemy = candidates.find(candidate => candidate.id === id)
        if (enemy) api.moveEnemyToward(enemy, inv.location, { ignoreAloof: true, source: '07231' })
      }
    },
    afterTest(state, inv, result, api, context) {
      if (result.success || context.ignoredSymbols) return
      for (const token of context.resolvedTokens) if (token === 'cultist') {
        // The printed effect happens after the test ends, so read the actual
        // current location following the original result callback.
        if (!state.locations.some(loc => loc.id === inv.location)) return
        if (api.mechanics.water.canChange(inv.location, 1)) api.mechanics.water.change(inv.location, 1)
        else if (harder(state)) api.horror(inv.seat, 1)
      }
    },
  },
})
