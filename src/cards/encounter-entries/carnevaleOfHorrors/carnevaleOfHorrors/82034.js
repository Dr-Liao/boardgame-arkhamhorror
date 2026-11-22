// 82034 水中混乱 · 诡计（恐怖狂欢节）
// 卡面：显现 - 检定[敏捷](4)。每位控制一名无辜的狂欢者的调查员也必须进行此技能检定。
//       每位失败的调查员受到 1 点伤害（须优先分配给其控制的无辜的狂欢者）。
// 读点：条目 treacheryRule.test。
export default {
  code: '82034',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    test: { skill: 'agility', difficulty: 4, fail: { kind: 'takeDamage', amount: 1 } },
  },
  note: '主检定用 treacheryRule.test 声明；多调查员附属检定的分支未接线。',
}
