// 02315 万物归一
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：强制 - 你由于遭遇卡牌的效果移动到一个地点后：受到1点恐惧。
// 卡面：强制 - 如果犹格·索托斯被击败，(→结局3)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02315', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const enemy = state.enemies.find(item => item.code === '02323')
      if (enemy) for (const inv of activeInvestigators(state)) api.attack(enemy, inv)
      // 换回同一张卡，保持 4a 在场上。
      state.agendas[state.agendaIndex] = { ...agenda }
    },
  },
}
