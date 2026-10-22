// 02312 一生万物
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：强制 - 你由于遭遇卡牌的效果移动到一个地点后：受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02312', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      api.shuffleDiscard()
      api.drawEncounterLocation(state.campaign.leadSeat)
      if (state.campaign.records.theInvestigatorsFailedToSaveTheStudents) {
        for (const inv of activeInvestigators(state)) api.horror(inv.seat, 1)
      }
    },
  },
}
