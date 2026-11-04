// 07124 路障重重（压迫议程 1）· 深陷其中
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害。
// 背面（中文）：「所有[[沿海]]地点提升淹没等级。将 07145 与 01181 从旁置区洗入遭遇牌库。
//   把遭遇弃牌堆洗回遭遇牌库。」
//
// 四张压迫议程同文不同潮（07125 加 1 点恐惧、07126 再随机弃 1 张手牌、07127 弃 2 张），
// 共同规则写在 _shared.js 的 floodedTurnEndAgenda 里；背面各自不同，条目只传 onReveal。

import { floodedTurnEndAgenda, barricadedStreetsBack } from '../../_shared.js'

export default floodedTurnEndAgenda({
  code: '07124',
  label: '你的回合结束且位于完全淹没的地点：受到 1 点伤害',
  horror: 0,
  discard: 0,
  // 读点：content entry-rules.js#agendaReveal → 条目 agendaRule.onReveal → api 原语
  //（mechanics.water.change / takeFromSetAside / shuffleIntoEncounterDeck / shuffleDiscard）。
  onReveal: barricadedStreetsBack,
})
