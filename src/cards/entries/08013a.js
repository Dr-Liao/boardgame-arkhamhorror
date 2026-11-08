// 08013a 演武·战斗（Unbroken 面，陈丽丽专属）
// 卡面：陈丽丽牌组专用；永久。你获得 +1 战斗。
// [行动]：你本回合下一次执行的技能检定获得 +5 技能值；那次技能检定结束后，将此支援翻面。
//          此行动不会引发借机攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
const UNBROKEN = '08013a'
const BROKEN = '08013b'

export default {
  code: UNBROKEN,
  modifiers: [
    { target: 'skill:combat', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action',
      label: '演武·战斗：下一次技能检定 +5；那次检定结束后翻面（不引发借机攻击）',
      cost: { action: true },
      noOpportunityAttack: true,
      resolve: ({ inv, source, api }) => {
        // 「下一次技能检定 +5」：duration='endOfTest' + controllerSeat 决定归属——
        //   · tests.js 只在**控制者本人**的检定结束时让这条效果过期，别人的检定不消耗它；
        //   · 回合结束时 turn-flow 的 expireEffects('endOfTurn') 统一清理（本回合没用掉即失效）；
        //   · 效果记录本身就是「这次 +N 是否还欠着」的唯一事实源（延迟翻面标记也以它在场为准）。
        api.addEffect({
          duration: 'endOfTest', sourceCode: UNBROKEN, sourceInstanceId: source.id,
          controllerSeat: inv.seat, label: '演武·战斗：下一次技能检定 +5',
          modifiers: [{ target: 'skill:*', amount: 5 }],
        })
        // 「那次技能检定结束后翻面」交给引擎的延迟翻面标记：tests.js#closeTest 只在本人检定
        // 结束时调 applyPendingFlipAfterTests(state, seat)；标记有效性由上面的效果唯一判定，
        // 轮边界（turn.js#beginInvestigationPhase）负责清理「用了但没做检定」的残留标记。
        api.flipAfterNextTest(source, BROKEN)
        return true
      },
    },
  ],
}
