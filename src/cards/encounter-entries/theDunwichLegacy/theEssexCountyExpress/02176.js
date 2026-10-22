// 02176 车头
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：车头与其左边的地点连接。
// 卡面：强制 - 在你揭示车头后：查找遭遇牌库和弃牌堆，找出一张黏液恐魔并将其抽取。混洗遭遇牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { investigatorAt } from '../../_shared.js'

export default {
  code: '02176', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      const investigator = investigatorAt(state, loc.id)
      if (!investigator) return
      for (const pile of [state.encounterDeck, state.encounterDiscard]) {
        const index = pile.indexOf('02182')
        if (index >= 0) {
          pile.splice(index, 1)
          state.encounterDeck.push('02182')
          api.drawEncounter(investigator.seat)
          break
        }
      }
      api.shuffleEncounterDeck()
    },
  },
}
