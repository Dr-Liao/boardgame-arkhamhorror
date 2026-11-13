// 09122 手电筒（Flashlight）· 中立资产 · 3 经验 · 手槽 · 使用（4 补给）
// 卡面：使用（4 补给）。
//       [reaction] 在你执行调查或尝试躲避时的技能检定时，花费 1 补给：本次检定得到难度值 -2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · testBegins 窗口（tests.js#performTest 开始时打开）——与本卡同一时机的反应都挂这里；
//   · 「调查或躲避」读 state.skillTest.actionKind（investigate / evade）；
//   · 难度 -2：api.reduceTestDifficulty（与「降低难度」同一写点）；补给是描述子 cost.uses。
const code = '09122'

export default {
  code,
  uses: 4,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testBegins',
      label: '调查/躲避检定时花费 1 补给：本次检定难度 -2',
      cost: { uses: 1 },
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [({ state, inv }) => {
        const test = state.skillTest
        return Boolean(test) && test.seat === inv.seat && ['investigate', 'evade'].includes(test.actionKind)
      }],
      resolve: ({ inv, api }) => {
        api.reduceTestDifficulty(2)
        api.info(`🔦 「手电筒」：${inv.name} 花费 1 补给，本次检定难度 -2。`)
      },
    },
  ],
  modifiers: [],
}
