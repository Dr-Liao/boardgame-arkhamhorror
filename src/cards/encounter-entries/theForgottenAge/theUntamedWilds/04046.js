// 04046 探索丛林
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：目标 - 在一轮结束时，位于任何非[[营地]]地点的调查员可以共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 幕 04046「探索丛林」：揭示时生成伊塔卡；轮末可共同花费线索推进。

import { hasTrait, locationOfInvestigator } from '../../_shared.js'

export default {
  code: '04046', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const lead = state.investigators[state.campaign.leadSeat] || state.investigators.find(inv => !inv.defeated && !inv.resigned)
      const spawnAt = lead?.location || 'expeditionCamp'
      if (!state.scenarioFlags?.ichtacaSpawned) {
        state.scenarioFlags.ichtacaSpawned = true
        api.spawn('04052', spawnAt)
      }
      state.encounterDeck = [...state.encounterDeck]
      api.shuffleDiscard()
    },
    roundEndCheck(state, act, api) {
      const required = 3 * state.numInvestigators
      const eligible = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        .filter(inv => !hasTrait(locationOfInvestigator(state, inv), 'Campsite'))
      const available = eligible.reduce((sum, inv) => sum + (inv.clues || 0), 0)
      if (available < required) return
      const answer = api.choose({
        kind: 'act', source: '04046', seat: state.campaign.leadSeat, canSkip: true,
        prompt: `非营地的调查员共有 ${available} 个线索，可以共同花费 ${required} 个推进场景。`,
        options: [{ id: 'advance', label: `支付 ${required} 个线索并推进` }],
      })
      if (answer !== 'advance') return
      let remaining = required
      for (const inv of eligible) {
        if (!remaining) break
        const pay = Math.min(remaining, inv.clues || 0)
        if (!pay) continue
        inv.clues -= pay
        remaining -= pay
      }
      state.clues = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        .reduce((sum, inv) => sum + (inv.clues || 0), 0)
      api.advanceAct()
    },
  },
}
