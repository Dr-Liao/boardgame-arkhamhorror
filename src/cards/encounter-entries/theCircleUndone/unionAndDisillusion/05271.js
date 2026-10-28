// 05271 死亡记号
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：显现 - 检定敏捷(2+你已受到的恐惧)。
// 如果你检定失败，受到 2 点伤害。
// 一卡一文件：规则只在这里维护；失败分支由 card-rules 的声明式检定统一结算。
export default {
  code: '05271',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    test: {
      skill: 'agility',
      difficulty: { base: 2, plus: 'horror' },
      fail: { kind: 'takeDamage', amount: 2 },
    },
  },
}
