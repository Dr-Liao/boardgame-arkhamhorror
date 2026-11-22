// 重返毁灭之地 · 章节行为：扭曲版山脚/山路、扩大后的小径候选。
import { BASE_BEHAVIORS, shuffleWith } from '../../shared.js'
import { DIVERGING_POOL, ALTERED_POOL, NAOMI_CODE } from './definition.js'

const base = BASE_BEHAVIORS.whereDoomAwaits
const original = card => card?.originalCode || card?.code

export const behavior = {
  ...base,
  id: 'returnToWhereDoomAwaits',
  setupLocations(state, events, ctx = {}) {
    const placed = base.setupLocations(state, events, ctx)
    const rng = () => (ctx.randomValue ? ctx.randomValue(state) : 0.5)
    const zones = state.scenarioZones
    // 扭曲版山脚/上山道路：占用基础章的两个槽位 id，保持后续钩子与行动不变。
    state.locationVariants['location02282'] = { ...structuredClone(state.scenario.locations['location51048']), id: 'location02282' }
    state.locationVariants['location02283'] = { ...structuredClone(state.scenario.locations['location51049']), id: 'location02283' }
    zones.divergingPaths = shuffleWith(DIVERGING_POOL, rng).slice(0, 3)
    zones.alteredPaths = shuffleWith(ALTERED_POOL, rng).slice(0, 3)
    // 51050/51051 的正面是「分岔路 / 迷幻小路」，背面才是真名。
    for (const [code, front] of [['51050', '分歧之路'], ['51051', '改变之路']]) {
      const def = state.scenario.locations[`location${code}`]
      if (!def || def.hiddenIdentity) continue
      def.hiddenIdentity = true
      def.unrevealedActualName = def.name
      def.name = front
    }
    // 若已有内奥米支持，51052 不再放在一边（基础章给予线索奖励，见基础 setupLocations）。
    if (state.campaign.records.naomiHasTheInvestigatorsBacks) {
      zones.setAside = (zones.setAside || []).filter(code => code !== NAOMI_CODE)
    }
    return placed
  },
  retPathDecks(state) {
    return { divergingPaths: [...(state.scenarioZones?.divergingPaths || [])], alteredPaths: [...(state.scenarioZones?.alteredPaths || [])] }
  },
}

export { shuffleWith, original }
