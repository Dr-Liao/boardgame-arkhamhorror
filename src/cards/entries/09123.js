// 09123 灵魂封圣（Soul Sanctification）· 中立资产 · 3 经验 · 永久 · 卓越 · [[仪式]]
// 卡面：永久。卓越。
//       你每治愈超过调查员当前伤害/恐惧 1 点，在灵魂封圣上放置 1 资源，作为贡品。这依然算作治愈。
//       [fast] 花费 1 贡品：你本次检定得到 +2 技能值。（每次检定仅限两次。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 永久 / 卓越：cards-data（permanent / exceptional），引擎开局放置永久卡；
//   · 贡品 = 本卡实例上的 uses（usesType 'offerings'）；「花费 1 贡品」是描述子 cost.uses；
//   · 本次检定 +2：api.addTestValue；每次检定最多 2 次用 limit { scope:'perTest' }；
//   · fast 时机：free 描述子 + test.beforeCommit / test.afterCommit 玩家窗口（performTest 内开窗）。
// 超量治疗在实际伤害或恐惧治疗窗口发放贡品。
const code = '09123'

export default {
  code,
  uses: 0,
  usesType: 'offerings',
  abilities: [
    {
      kind: 'forced', trigger: 'healOverflow', silent: true,
      label: '每超量治愈 1 点，在此支援上放置 1 贡品',
      criteria: [({ inv, context }) => context.seat === inv.seat && context.amount > 0],
      resolve: ({ source, context, api }) => api.addUses(source, context.amount),
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '[fast] 花费 1 贡品：本次检定 +2 技能值（每次检定最多 2 次）',
      cost: { uses: 1 },
      limit: { scope: 'perTest', owner: 'investigator', count: 2 },
      resolve: ({ inv, api }) => {
        api.addPendingTestBonus(2)
        api.info(`🕯️ 「灵魂封圣」：${inv.name} 花费 1 贡品，本次检定 +2 技能值。`)
      },
    },
  ],
  modifiers: [],
}
