// 07199 追逐开始！（版本一）· 全速恐惧（议程 1a）
//
// 印刷（中文）：
//   你不在载具上时，作为移动的额外费用，你必须花费2行动。
//   强制 - 当一轮结束时：从最后方的地点开始，将每个没有载具、敌人和调查员的地点放在一边，
//          位于场外(或如果其有胜利X且没有线索，将其放入胜利区)。在到达有载具、敌人或调查员的地点时；
//          或在最后方的调查员后方一个地点停下。
// 印刷（英文）：
//   As an additional cost for you to move while not in a vehicle, you must spend 2 actions.
//   Forced - At the end of the round: Starting with the rearmost location, set each location with no
//   vehicles, enemies, or investigators aside, out of play (or add it to the victory display if it has
//   Victory X and has no clues on it). Stop when you reach a location with at least 1 vehicle, enemy,
//   or investigator; or the location behind the rearmost investigator.
//
// 引擎读点（三张同文议程共用的部分全部在 _shared.js#chaseAgendaEntry，本文件只写卡号与背面）：
//   · 步行额外费用：`agendaRule.movementActionSurcharge: { amount: 2 }`（turn-flow.js，载具上不付）；
//   · 轮末道路清理：`agendaRule.onRoundEnd`（phases.js 的 upkeepPhase 读点）→
//     `_shared.js#chaseRoundEndCleanup`（最小列 = 最后方；被占地点/最后方调查员列-1 处停；
//     Victory X 且无线索 → api.awardLocationVictory，其余 api.removeLocationFromGame）；
//   · 背面（1b）= 本文件 onReveal：生成「魔鬼礁石的骇物」07199b 到**最后方**地点，
//     随后引擎照常推进到密谋 2（07201）。生成点用 `_shared.js#roadRearmostLocations`
//     （列号最小的地点；并列时由领队选），生成后不与任何人交战（印刷没有「与你交战」）。
//
// 共用模板位置：07200（版本二）/ 07201（热力追踪）与本文完全相同的前两句；
// 三张的背面不同（07199 → 07199b 敌人；07200 → Just Our Luck；07201 → Out of Gas）。
//
// implemented：正面两句由 _shared.js#chaseAgendaEntry 提供读点；背面 onReveal 在本文件，
//   全部有测试（tests/tic-middle-remaining.test.mjs）。

import { chaseAgendaEntry, roadRearmostLocations } from '../../_shared.js'

export default chaseAgendaEntry({
  code: '07199',
  onReveal(state, agenda, api) {
    const candidates = roadRearmostLocations(state)
    if (!candidates.length) {
      api.info?.('⚠️ 道路未初始化：魔鬼礁石的骇物无法按「最后方的地点」生成。')
      return
    }
    let locationId = candidates[0]
    if (candidates.length > 1) {
      const answer = api.choice({
        kind: 'location', source: '07199', seat: state.campaign?.leadSeat ?? 0,
        prompt: '选择「魔鬼礁石的骇物」生成时最后方的地点。',
        options: candidates.map(id => ({ id, label: state.locations.find(location => location.id === id)?.name || id })),
      })
      if (candidates.includes(answer)) locationId = answer
    }
    const spawned = api.spawn('07199b', locationId)
    if (spawned) api.info?.(`👹 密谋 1b：魔鬼礁石的骇物在最后方的地点「${spawned.location}」现身。`)
  },
})
