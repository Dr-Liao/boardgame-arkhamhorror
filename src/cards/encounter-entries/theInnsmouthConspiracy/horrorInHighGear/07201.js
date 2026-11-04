// 07201 热力追踪 · 全速恐惧（议程 2a）
//
// 印刷（中文）：
//   正面：你不在载具上时，作为移动的额外费用，你必须花费2行动。
//         强制 - 当一轮结束时：从最后方的地点开始，将每个没有载具、敌人和调查员的地点放在一边，
//         位于场外(或如果其有胜利X且没有线索，将其放入胜利区)。在到达有载具、敌人或调查员的地点时；
//         或在最后方的调查员后方一个地点停下。
//   背面「燃料耗尽」：每位调查员被击败并承受1点肉体创伤。
// 印刷（英文）：
//   Front: As an additional cost for you to move while not in a vehicle, you must spend 2 actions.
//     Forced - At the end of the round: ... (same as 07199)
//   Back "Out of Gas": Each investigator is defeated and suffers 1 physical trauma.
//
// 引擎读点：
//   · 正面同文部分（步行费用 + 轮末道路清理）全部在 `_shared.js#chaseAgendaEntry`；
//   · 背面 = 本文件 onReveal：逐位未败退调查员 `api.trauma(seat,'physical',1)` +
//     `api.defeat(inv)`（写入口同 07044「深海献祭」：以效果击败并明确加一次肉体创伤，
//     不伪造超量伤害）。全部被击败后引擎推进议程到牌堆底 → checkOutcome → 无结局（noResolution：
//     「调查员在日出后到达猎鹰岬」）。
//
// 共用模板位置：07200（版本二）的 Just Our Luck 与 07199（版本一）的背面敌人是同一句印刷块的
// 三种不同背面；正面三张逐字相同，规则只写在 _shared.js 的工厂里。
//
// implemented：正面由工厂读点承担；背面 onReveal 在本文件，全部有测试
//   （tests/tic-middle-remaining.test.mjs）。

import { chaseAgendaEntry } from '../../_shared.js'

export default chaseAgendaEntry({
  code: '07201',
  onReveal(state, agenda, api) {
    for (const inv of state.investigators.filter(inv => !inv.defeated && !inv.resigned)) {
      api.trauma(inv.seat, 'physical', 1)
      api.defeat(inv)
    }
    api.info?.('💥 背面「燃料耗尽」：每位调查员被击败并承受 1 点肉体创伤。')
  },
})
