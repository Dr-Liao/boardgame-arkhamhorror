// 07125 无情浪潮（压迫议程 2）· 深陷其中
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害和1点恐惧。
// 背面（中文）：「所有[[市中心]]地点提升淹没等级。将愤怒暴民 07062b 生成在印斯茅斯广场，
//   并在其身上放置 1 个未揭示的钥匙。」

import { floodedTurnEndAgenda, relentlessTideBack } from '../../_shared.js'

export default floodedTurnEndAgenda({
  code: '07125',
  label: '你的回合结束且位于完全淹没的地点：受到 1 点伤害和 1 点恐惧',
  horror: 1,
  discard: 0,
  onReveal: relentlessTideBack,
})
