// 07127 深海之怒（Rage of the Deep）· 议程 4 · 深陷其中 第三章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害和1点恐惧，并随机弃掉你2张手牌。
//   背面（推进时）：在剧本日志中，记录印斯茅斯被怒潮吞没。
//     每位没有撤退的调查员被击败并承受1点肉体创伤。
//
// 引擎读点：
//   · 正面同 07124 的工厂。
//   · 背面：api.setCampaignRecord（records.js 已登记的布尔记录）；
//     api.addTrauma(seat,'physical',1) 与 api.defeatInvestigator(seat)（scenario-runtime 原语，
//     后者做标记 + eliminateInvestigator 退场清理）；全灭后按剧本的 noResolution 重定向结束
//     （resolutions.js#inTooDeep 把 noResolution 重定向到 resolution1）。

import {
  floodedStreetAgendaRule, floodedStreetTurnEndAbility, originalOf,
} from '../../_shared.js'

export default {
  code: '07127', scope: 'agenda', implemented: true,
  abilities: [floodedStreetTurnEndAbility({ damage: 1, horror: 1, discard: 2 })],
  agendaRule: floodedStreetAgendaRule({
    onReveal(state, agenda, api) {
      api.setCampaignRecord('InnsmouthWasConsumedByTheRisingTide', true)
      for (const inv of state.investigators.filter(item => !item.resigned && !item.defeated)) {
        api.addTrauma(inv.seat, 'physical', 1)
        api.defeatInvestigator(inv.seat)
      }
      api.info(`「${originalOf(agenda)}」背面：印斯茅斯被怒潮吞没；未撤退的调查员全部被击败。`)
      api.finish('noResolution')
    },
  }),
}
