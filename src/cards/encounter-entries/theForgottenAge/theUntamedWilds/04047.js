// 04047 埃兹特里的女猎手
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：目标 - 如果伊塔卡被击败，推进场景。
// 卡面：目标 - 如果伊塔卡上有1[per_investigator]线索，将她放到胜利区并推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 幕 04047「埃兹特里的女猎手」：按「线索」或「击败」推进第三幕。

import { originalOf } from '../../_shared.js'

export default {
  code: '04047', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const byClues = state.scenarioFlags.actTwoAdvancedWith !== 'defeat'
      const ichtaca = state.enemies.find(enemy => originalOf(enemy) === '04052')
      if (byClues) {
        if (ichtaca) api.addEnemyToVictory(ichtaca)
        api.setCampaignRecord('ichtacaHasConfidenceInYou', true)
        api.setCampaignRecord('theInvestigatorsHaveEarnedIchtacasTrust', true)
        api.changeChaosBag('cultist', 1, { permanent: true })
        api.setScenarioFlag('ichtacaLeadsTheWay')
        api.setActDeckCards(2, ['04048'], { silent: true })
        api.setScenarioFlag('actThree', 'search')
      } else {
        if (ichtaca) api.removeEnemyFromGame(ichtaca)
        api.setCampaignRecord('theInvestigatorsFoughtWithIchtaca', true)
        api.setCampaignRecord('ichtacaIsWaryOfTheInvestigators', true)
        api.changeChaosBag('tablet', 1, { permanent: true })
        const volunteers = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const target = volunteers.length === 1 ? volunteers[0] : api.choose({
          kind: 'investigator', source: '04047', seat: state.campaign.leadSeat,
          prompt: '选择一位调查员控制亚历山卓·维拉。',
          options: volunteers.map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
        const seat = Number(target)
        const owner = volunteers.find(inv => inv === target || inv.seat === seat)
        if (owner) {
          api.takeFromSetAside('04051')
          api.giveAsset(owner.seat, '04051')
        }
        api.setActDeckCards(2, ['04049'], { silent: true })
        api.setScenarioFlag('actThree', 'guarded')
      }
      // 第三幕要把还没入场的遗迹地点放回探索牌库（场景定义里的 setAsideLocations 就是这三处遗迹）。
      const ruins = (state.scenario.setAsideLocations || []).filter(id => !state.locations.some(location => location.id === id))
      for (const id of ruins) api.takeFromSetAside(state.scenario.locations[id].originalCode)
      api.addToExplorationDeck(ruins)
    },
    objectiveCheck(state, act, api) {
      const ichtaca = state.enemies.find(enemy => originalOf(enemy) === '04052')
      if (!ichtaca) {
        if (state.scenarioFlags?.ichtacaSpawned) {
          api.setScenarioFlag('actTwoAdvancedWith', 'defeat')
          api.advanceAct()
        }
        return
      }
      if ((ichtaca.clues || 0) >= state.numInvestigators) {
        api.setScenarioFlag('actTwoAdvancedWith', 'clues')
        api.advanceAct()
      }
    },
  },
}
