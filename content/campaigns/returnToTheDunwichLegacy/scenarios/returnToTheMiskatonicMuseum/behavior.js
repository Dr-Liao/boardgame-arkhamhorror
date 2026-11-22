// 重返博物馆之夜 · 章节行为：7 张展厅候选与 4 幕牌库，其余沿用基础章。
import { BASE_BEHAVIORS, shuffleWith } from '../../shared.js'
import { EXHIBIT_CANDIDATES, RESTRICTED_HALL } from './definition.js'

const base = BASE_BEHAVIORS.theMiskatonicMuseum
const original = card => card?.originalCode || card?.code

export const behavior = {
  ...base,
  id: 'returnToTheMiskatonicMuseum',
  setupLocations(state, events, ctx = {}) {
    const placed = base.setupLocations(state, events, ctx)
    const rng = () => (ctx.randomValue ? ctx.randomValue(state) : 0.5)
    // 重返保留 4 幕：基础实现移除了 02124（强行闯入），这里补回。
    if (!state.acts.some(act => original(act) === '02124')) {
      const act = state.scenario.acts.find(item => original(item) === '02124')
      if (act) state.acts.splice(2, 0, structuredClone(act))
    }
    // 7 张展厅候选洗混后随机移出 2 张；剩余 5 张中 2 张与限制展厅一起构成底部 3 张。
    const candidates = shuffleWith(EXHIBIT_CANDIDATES, rng).slice(0, 5)
    const bottom = candidates.slice(0, 2)
    const top = candidates.slice(2)
    state.scenarioZones ||= {}
    state.scenarioZones.exhibits = [...shuffleWith([RESTRICTED_HALL, ...bottom], rng), ...top]
    return placed
  },
  retExhibitDeck(state) { return [...(state.scenarioZones?.exhibits || [])] },
}

export const retHelpers = { shuffleWith }
