// 06160 “让上帝分辨去吧……”
// 卡面：你在自己的一个回合期间，击败总计生命值至少为6点的敌人方可打出。
// 卡面：将“让上帝分辨去吧……”加入胜利区，立即结束你的回合。
//       在本场冒险结局期间调查员取得经验值时，你取得额外1点经验值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 本回合击败敌人的动态总生命由 trackDefeatedEnemyHealth 记录；
// addScenarioXpBonus 在结局分配经验时为本人额外加 1 点。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '06160',
  trackDefeatedEnemyHealth: true,
  playCondition: [ownTurn(), {
    when: ({ state, inv }) => inv.defeatedHealthHistory?.turn === state.turnSerial
      && inv.defeatedHealthHistory.total >= 6,
    message: '本回合击败的敌人总生命值尚未达到 6',
  }],
  abilities: [
    {
      kind: 'played',
      label: '加入胜利区并立即结束你的回合',
      addToVictory: true,
      resolve: ({ state, inv, api }) => {
        api.addScenarioXpBonus(inv.seat, 1)
        api.info(`🏆 「${api.cardName('06160')}」加入胜利区，${inv.name} 的回合立即结束。`)
        api.endTurn(inv.seat)
      },
    },
  ],
  modifiers: [],
}
