// 02177 车头
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：车头与其左边的地点连接。
// 卡面：强制 - 在你揭示车头后：抽取遭遇牌库顶3张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { investigatorAt } from '../../_shared.js'

export default {
  code: '02177', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      const investigator = investigatorAt(state, loc.id)
      if (!investigator) return
      for (let index = 0; index < 3; index++) api.drawEncounter(investigator.seat)
    },
  },
}
