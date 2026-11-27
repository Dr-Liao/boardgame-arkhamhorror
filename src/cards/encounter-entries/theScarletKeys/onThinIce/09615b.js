// 09615b 域外来客之巢 · 地点（onThinIce）
// 已揭示且无线索时，虚空奇美拉（真实形态）的攻击和躲避各降低 1。
export default {
  code: '09615b',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 4, printedClues: 2 },
  locationRule: {
    enemyStatModifier(location, enemy, stat) {
      const trueForm = (enemy.originalCode || enemy.code) === '09626'
      return location.revealed && (location.clues || 0) === 0 && trueForm && ['fight', 'evade'].includes(stat) ? -1 : 0
    },
  },
}
