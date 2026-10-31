// 06160 “让上帝分辨去吧……”
// 卡面：你在自己的一个回合期间，击败总计生命值至少为6点的敌人方可打出。
// 卡面：将“让上帝分辨去吧……”加入胜利区，立即结束你的回合。
//       在本场冒险结局期间调查员取得经验值时，你取得额外1点经验值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：ownTurn 打出条件；played 描述子 addToVictory（读点 doPlay 收尾，把事件放进胜利区）；
// api.endTurn 立即结束回合。
// 显式简化（simplified）：
//   ①「本回合击败总计生命值 ≥6 的敌人」——引擎没有「本回合击败敌人总生命」的回合历史读取点；
//   ②「结局结算经验时额外 +1 经验」——没有经验值写入的 ctx.api（经验在战役层结算）。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '06160',
  simplified: true,
  note: '未实现：①「本回合击败总计生命值 ≥6 点的敌人」的前置条件（引擎没有回合内的击败历史读取点，'
    + '打出的时机只由 ownTurn 约束）；②「结局结算经验时额外 +1 经验」（经验值在战役层结算，没有 ctx.api 写入口）。'
    + '「加入胜利区、立即结束你的回合」已实现。',
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      label: '加入胜利区并立即结束你的回合',
      addToVictory: true,
      resolve: ({ state, inv, api }) => {
        api.info(`🏆 「${api.cardName('06160')}」加入胜利区，${inv.name} 的回合立即结束。`)
        api.endTurn(inv.seat)
      },
    },
  ],
  modifiers: [],
}
