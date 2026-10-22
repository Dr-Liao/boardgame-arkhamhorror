// 02314 突破
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：强制 - 你由于遭遇卡牌的效果移动到一个地点后：受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { scenarioLocationId } from '../../_shared.js'

export default {
  code: '02314', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const origin = scenarioLocationId(state, '02321') || scenarioLocationId(state, '02320') || 'location02320'
      const enemy = api.spawn('02323', origin)
      if (enemy) enemy.health = 4 + 6 * state.numInvestigators
    },
  },
}
