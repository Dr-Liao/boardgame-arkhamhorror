// 07126 水漫街道（Flooded Streets）· 议程 3 · 深陷其中 第三章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害和1点恐惧，并随机弃掉你1张手牌。
//   背面（推进时）：提升每个地点的淹没等级。按玩家顺序，每位调查员抽取1张遭遇卡牌。
//
// 引擎读点：
//   · 正面同 07124 的工厂；随机弃手牌走 api.discardRandomFromHand（api-misc.js）。
//   · 背面：所有地点 water.change；按玩家顺序（从队长起逆时针轮转）api.drawEncounter(seat)。

import {
  floodedStreetAgendaRule, floodedStreetTurnEndAbility, originalOf,
} from '../../_shared.js'

export default {
  code: '07126', scope: 'agenda', implemented: true,
  abilities: [floodedStreetTurnEndAbility({ damage: 1, horror: 1, discard: 1 })],
  agendaRule: floodedStreetAgendaRule({
    onReveal(state, agenda, api) {
      for (const location of state.locations) api.mechanics.water.change(location.id, 1)
      const total = state.investigators.length
      const lead = Number(state.campaign.leadSeat) || 0
      for (let offset = 0; offset < total; offset++) {
        const inv = state.investigators[(lead + offset) % total]
        if (inv && !inv.defeated && !inv.resigned) api.drawEncounter(inv.seat)
      }
      api.info(`「${originalOf(agenda)}」背面：全城涨水；调查员按玩家顺序各抽 1 张遭遇卡。`)
    },
  }),
}
