// 04047 埃兹特里的女猎手
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：目标 - 如果伊塔卡被击败，推进场景。
// 卡面：目标 - 如果伊塔卡上有1[per_investigator]线索，将她放到胜利区并推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 幕 04047「埃兹特里的女猎手」：按「线索」或「击败」推进第三幕。

import { originalOf, addPermanentChaosTokens, mixIntoEntry } from '../../_shared.js'

export default {
  code: '04047', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const byClues = state.scenarioFlags.actTwoAdvancedWith !== 'defeat'
      const ichtaca = state.enemies.find(enemy => originalOf(enemy) === '04052')
      const thirdAct = code => structuredClone(state.scenario.acts.find(card => originalOf(card) === code))
      if (byClues) {
        if (ichtaca) {
          const index = state.enemies.indexOf(ichtaca)
          if (index >= 0) state.enemies.splice(index, 1)
          state.victoryDisplay.push({ id: ichtaca.id, code: '04052', originalCode: '04052', victory: 1 })
        }
        state.campaign.records.ichtacaHasConfidenceInYou = true
        state.campaign.records.theInvestigatorsHaveEarnedIchtacasTrust = true
        addPermanentChaosTokens(state, 'cultist', 1)
        state.scenarioFlags.ichtacaLeadsTheWay = true
        state.acts = [state.acts[0], state.acts[1], thirdAct('04048')]
        state.scenarioFlags.actThree = 'search'
      } else {
        if (ichtaca) {
          const index = state.enemies.indexOf(ichtaca)
          if (index >= 0) state.enemies.splice(index, 1)
        }
        state.campaign.records.theInvestigatorsFoughtWithIchtaca = true
        state.campaign.records.ichtacaIsWaryOfTheInvestigators = true
        addPermanentChaosTokens(state, 'tablet', 1)
        const volunteers = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const target = volunteers.length === 1 ? volunteers[0] : api.choose({
          kind: 'investigator', source: '04047', seat: state.campaign.leadSeat,
          prompt: '选择一位调查员控制亚历山卓·维拉。',
          options: volunteers.map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
        const seat = Number(target)
        const owner = state.investigators[Number.isInteger(seat) ? seat : volunteers[0].seat]
        if (owner) api.giveAsset(owner.seat, '04051')
        state.acts = [state.acts[0], state.acts[1], thirdAct('04049')]
        state.scenarioFlags.actThree = 'guarded'
      }
      // 第三幕要把还没入场的遗迹地点放回探索牌库（场景定义里的 setAsideLocations 就是这三处遗迹）。
      for (const id of state.scenario.setAsideLocations || []) {
        if (state.locations.some(location => location.id === id)) continue
        state.explorationDeck.push(id)
      }
      state.explorationDeck = mixIntoEntry(state, api, state.explorationDeck)
    },
    objectiveCheck(state, act, api) {
      const ichtaca = state.enemies.find(enemy => originalOf(enemy) === '04052')
      if (!ichtaca) {
        if (state.scenarioFlags?.ichtacaSpawned) {
          state.scenarioFlags.actTwoAdvancedWith = 'defeat'
          api.advanceAct()
        }
        return
      }
      if ((ichtaca.clues || 0) >= state.numInvestigators) {
        state.scenarioFlags.actTwoAdvancedWith = 'clues'
        api.advanceAct()
      }
    },
  },
}
