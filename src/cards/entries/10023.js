// 10023 狼面具（Wolf Mask · The Moon's Sire）· 守卫者资产 · 0 经验 · 无槽位
// 卡面：每位调查员仅限 1 张 [[面具]]。
//       使用(2 贡品)。你与敌人交战后，补满其中的 1 个贡品。
//       [fast] 花费 1 贡品：你本次技能检定得到 +2[combat] 或 +2[agility]。（每次检定仅限一次。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「每位调查员仅限 1 张[[面具]]」：`assetRule.controlledTraitLimit: { trait: 'Mask', amount: 1 }`
//     （assets.js#exceedsControlledTraitLimit 是唯一读点，canEquip 调用）。
//   · 使用次数：条目级 `uses: 2` / `usesType: 'offerings'`；补充走 `api.addUses`，上限 2。
//   · 「你与敌人交战后」：`enemyEngaged` 窗口（enemies.js#engageEnemy 派发，context =
//     { enemy, seat }）；补满在反应 resolve 里。
//   · [fast] 检定加值：`kind: 'free'` + `trigger: 'test.beforeCommit'` + `duringOwnSkillTest`
//     （playerWindow 的免费能力枚举读点），加值走 `api.addPendingTestBonus(2)`（tests.js 在窗口
//     结束后并入本次检定）；「每次检定仅限一次」= `limit: { scope: 'perTest', owner: 'instance' }`；
//     费用 = `cost: { uses: 1 }`（不花行动）。
//   · 只对 [combat] / [agility] 检定有效：criteria 读 state.skillTest.skill（同一份检定状态，
//     与 card-model B3 的结果契约同源）。
const CODE = '10023'
const MAX_OFFERINGS = 2
const BONUS_SKILLS = ['combat', 'agility']

export default {
  code: CODE,
  name: 'Wolf Mask',
  uses: MAX_OFFERINGS,
  usesType: 'offerings',
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemyEngaged',
      label: '你与敌人交战后：补满 1 个贡品',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ source, api }) => {
        if (!source) return
        const gain = Math.min(1, Math.max(0, MAX_OFFERINGS - (source.uses || 0)))
        if (gain <= 0) return
        api.addUses(source, gain)
        api.info(`🐺 狼面具：与敌人交战后，补满 ${gain} 个贡品（${source.uses}/${MAX_OFFERINGS}）。`)
      },
    },
    {
      kind: 'free',
      trigger: 'test.beforeCommit',
      duringOwnSkillTest: true,
      label: '花 1 贡品：本次[combat]或[agility]检定 +2（每次检定仅限一次）',
      cost: { action: false, uses: 1 },
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [({ state }) => {
        const skill = state.skillTest?.skill
        return Array.isArray(skill)
          ? skill.some(name => BONUS_SKILLS.includes(name))
          : BONUS_SKILLS.includes(skill)
      }],
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [],
}
