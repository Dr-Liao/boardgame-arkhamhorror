// 04044 荒野探险
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 密谋 04044「荒野探险」：洗入伊格的使徒并让未中毒者做意志（3）检定。

import { isPoisonedInvestigator } from '../../_shared.js'

export default {
  code: '04044', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const card of ['04083', '04084', '04085']) {
        let index = (state.scenarioZones?.setAside || []).indexOf(card)
        while (index >= 0) {
          state.scenarioZones.setAside.splice(index, 1)
          state.encounterDeck.push(card)
          index = (state.scenarioZones?.setAside || []).indexOf(card)
        }
      }
      api.shuffleDiscard()
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        api.test(inv.seat, 'willpower', 3, result => {
          if (result.success) return
          if (isPoisonedInvestigator(inv)) {
            api.damage(inv.seat, 1)
            api.horror(inv.seat, 1)
          } else api.poison(inv.seat)
        })
      }
    },
  },
}
