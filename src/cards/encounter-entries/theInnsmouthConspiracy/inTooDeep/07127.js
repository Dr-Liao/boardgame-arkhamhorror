// 07127 深海之怒（压迫议程 4）· 深陷其中
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害和1点恐惧，并随机弃掉你2张手牌。
// 背面（中文）：「记录印斯茅斯被上涨的潮水吞没。每位调查员受到 1 点物理创伤并被击败。」

import { floodedTurnEndAgenda, rageOfTheDeepBack } from '../../_shared.js'

export default floodedTurnEndAgenda({
  code: '07127',
  label: '你的回合结束且位于完全淹没的地点：受到 1 点伤害和 1 点恐惧，随机弃 2 张手牌',
  horror: 1,
  discard: 2,
  onReveal: rageOfTheDeepBack,
})
