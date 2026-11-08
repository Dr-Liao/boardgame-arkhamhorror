// 08075 厄运手镯（Bangle of Jinxes）· 幸存者（Survivor）资产 · 饰品 · 1 经验。
//
// 卡面：使用(1 充能)。
//       [free] 花费 1 充能：你本次技能检定得到技能值 +2。(每次检定仅限一次。)
//       [reaction] 一个敌人攻击你后：在厄运手镯上放置 1 充能。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：检定中加值 = api.addPendingTestBonus；反应的攻击窗口 = enemyAttacked（含被取消的攻击，
// 与 07027/08001 同一窗口）；充能读写 = api.addUses。
export default {
  code: '08075',
  uses: 1,
  usesType: 'charges',
  abilities: [
    {
      kind: 'free',
      cost: { uses: 1 },
      limit: { scope: 'perTest', owner: 'player' },
      label: '花费 1 充能：本次技能检定 +2（每次检定限一次）',
      criteria: [({ state }) => Boolean(state.skillTest)],
      resolve: ({ inv, api }) => {
        api.addPendingTestBonus(2)
        api.info(`📿 「厄运手镯」：${inv.name} 本次技能检定 +2 技能值。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyAttacked',
      label: '敌人攻击你后：在厄运手镯上放置 1 充能',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.info(`📿 「厄运手镯」：放置 1 充能（当前 ${source.uses || 0}）。`)
      },
    },
  ],
  modifiers: [],
}
