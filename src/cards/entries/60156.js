// 60156 警犬（Police Dog，0 级）
// 卡面：[free] 你所在地点的攻击或调查期间，横置警犬：执行检定的调查员本次检定技能值 +1。
// 读点：free 描述子 trigger test.beforeCommit（05028 同窗口）+ api.addTestValue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60156',
  abilities: [{
    kind: 'free',
    trigger: 'test.beforeCommit',
    label: '横置：本次攻击或调查 +1 技能值',
    cost: { exhaust: true },
    criteria: [({ state, inv }) => {
      const test = state.skillTest
      if (!test) return false
      if (!['fight', 'investigate'].includes(test.actionKind)) return false
      const performer = state.investigators[test.seat]
      return Boolean(performer) && performer.location === inv.location
    }],
    resolve: ({ api }) => api.addTestValue(1),
  }],
  modifiers: [],
}
