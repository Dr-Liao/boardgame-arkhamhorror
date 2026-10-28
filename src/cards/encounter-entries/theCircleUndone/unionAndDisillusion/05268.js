// 05268 渴望死亡
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：显现 - 检定意志(2+你已受到的伤害)。
// 如果你检定失败，受到 2 点恐惧。
// 一卡一文件：规则只在这里维护；失败分支由 card-rules 的声明式检定统一结算。
export default {
  code: '05268',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    test: {
      skill: 'willpower',
      difficulty: { base: 2, plus: 'damage' },
      fail: { kind: 'takeHorror', amount: 2 },
    },
  },
}
