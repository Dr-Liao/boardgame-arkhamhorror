// 07126 水漫街道（压迫议程 3）· 深陷其中
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害和1点恐惧，并随机弃掉你1张手牌。
//
// 共同规则见 _shared.js 的 floodedTurnEndAgenda。

import { floodedTurnEndAgenda } from '../../_shared.js'

export default floodedTurnEndAgenda({
  code: '07126',
  label: '你的回合结束且位于完全淹没的地点：受到 1 点伤害和 1 点恐惧，随机弃 1 张手牌',
  horror: 1,
  discard: 1,
})
