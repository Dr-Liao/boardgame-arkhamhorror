// 重返无人知晓 · 章节行为：混合子嗣池、按献祭数生成，其余沿用基础章。
import { BASE_BEHAVIORS, shuffleWith } from '../../shared.js'
import { BROOD_POOL, BROOD_PER_PLAYER, FORMULA_CODE } from './definition.js'

const base = BASE_BEHAVIORS.undimensionedAndUnseen

export const behavior = {
  ...base,
  id: 'returnToUndimensionedAndUnseen',
  setupLocations(state, events, ctx = {}) {
    const placed = base.setupLocations(state, events, ctx)
    const rng = () => (ctx.randomValue ? ctx.randomValue(state) : 0.5)
    const zones = state.scenarioZones
    const sacrificed = (state.campaign.records.sacrificedToYogSothoth || []).length
    const total = sacrificed >= 4 ? 2 : sacrificed === 3 ? 3 : sacrificed === 2 ? 4 : 5
    const initial = sacrificed >= 4 ? [] : sacrificed >= 2 ? ['location02244'] : ['location02244', 'location02248']
    const pool = shuffleWith(BROOD_POOL, rng).slice(0, total)
    zones.brood = { total, initial, spawned: pool.slice(0, initial.length), remaining: pool.slice(initial.length) }
    zones.setAside = [...Array(4).fill(FORMULA_CODE), ...zones.brood.remaining]
    state.acts[0].objective = { type: 'clues', perInvestigator: 2, atLocation: 'location02250' }
    return placed
  },
  setupEnemies(state, events, api) {
    const brood = state.scenarioZones?.brood
    if (!brood?.spawned?.length) return
    brood.initial.forEach((locationId, index) => {
      const code = brood.spawned[index]
      if (!code) return
      const enemy = api.spawnEnemy(state, code, locationId, null)
      if (!enemy) return
      const printed = Number(state.scenario.enemies[code]?.health || 1)
      enemy.health = printed + state.numInvestigators * (BROOD_PER_PLAYER[code] || 1)
    })
  },
  retBroodPool(state) { return [...(state.scenarioZones?.brood?.spawned || [])] },
}

export { shuffleWith }
