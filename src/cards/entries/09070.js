// 09070 风险精算（Calculated Risk）· 游荡者（Rogue）技能 · 0 经验 · 策略 · 命运。
//
// 卡面：每次技能检定最多投入 1 张。
//       只能在你的回合，投入你正在执行的任意类型的检定。
//       你本回合每执行一个行动（包括本行动），风险精算获得 1[wild]。
//       本次检定结束后，结束你的回合。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 动态图标 → commit 档案的 iconBonus（stats.js#conditionalCommitIcons，与 08052 同一读点）；
//     「本回合已执行行动数」读 state.phaseActionCount——dispatch.js:461-464 在本次行动结算**之前**
//     就把该行动计入（含本行动），因此图标数 = max(1, phaseActionCount)，不能再 +1
//     （P1-8：旧公式 count+1 实际多算 1 个图标）。
//   · 投入限制 → commit 档案的 maxPerTest / selfTestOnly / commitCondition（commit-rules.js 的读点）。
//   · 「检定结束后结束回合」→ testEnds 窗口（tests.js 在投入卡还在 committed 里时开窗）+
//     api.endTurn（唯一结束回合入口）。
export default {
  code: '09070',
  abilities: [
    {
      kind: 'commit',
      label: '风险精算：本回合每执行一个行动（含本行动）获得 1 个[wild]图标',
      skill: {
        maxPerTest: 1,
        selfTestOnly: true,
        commitCondition: ({ state, owner }) => state.currentSeat === owner.seat,
        iconBonus: ({ state }) => Math.max(1, Number(state?.phaseActionCount) || 0),
      },
    },
    {
      kind: 'forced',
      trigger: 'testEnds',
      label: '本次检定结束后：结束你的回合',
      criteria: [({ state, inv }) => (state.skillTest?.committed || [])
        .some(item => (item.code || item) === '09070' && (item.seat == null || item.seat === inv.seat))],
      resolve: ({ state, inv, api }) => {
        if (state.currentSeat !== inv.seat) return
        api.endTurn(inv.seat)
        api.info(`♟️ 「风险精算」：检定结束，${inv.name} 的回合结束。`)
      },
    },
  ],
  modifiers: [],
}
