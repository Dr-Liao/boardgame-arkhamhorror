// 02120 浓厚之影
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：强制 - 在追猎恐魔入场时：将放在一边的暗影之子附属到追猎恐魔上，如果暗影之子已经附属，则在上面增加1资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { scenarioLocationId, summonHuntingHorror } from '../../_shared.js'

export default {
  code: '02120', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const horror = state.enemies.find(enemy => enemy.code === '02141')
      if (horror) horror.doom++
      else summonHuntingHorror(state, scenarioLocationId(state, '02127') || 'location02127', api)
      api.shuffleDiscard()
    },
  },
}
