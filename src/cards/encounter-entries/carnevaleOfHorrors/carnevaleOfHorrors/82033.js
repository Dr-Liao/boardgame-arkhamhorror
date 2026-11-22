// 82033 监视者的注视 · 诡计（恐怖狂欢节）
// 卡面：显现 - 检定[意志](4)。每位控制一名无辜的狂欢者的调查员也必须进行此技能检定。
//       每位失败的调查员受到 1 点恐惧（须优先分配给其控制的无辜的狂欢者）。
// 读点：条目 treacheryRule.test（显相检定声明）；读点 src/cards/card-rules.js#resolveDeclarativeTreacheryTest。
export default {
  code: '82033',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    test: { skill: 'willpower', difficulty: 4, fail: { kind: 'takeHorror', amount: 1 } },
  },
  note: '主检定用 treacheryRule.test 声明；「控制无辜狂欢者者也要检定」与「优先分配给无辜狂欢者」未接线（本实现按每人自身恐惧结算）。',
}
