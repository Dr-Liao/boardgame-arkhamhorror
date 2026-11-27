// 09577 大巴扎 · 地点（dealingsInTheDark）
// 对此地的隐匿迷你卡执行攻击或躲避时，检定难度 +2。
export default {
  code: '09577',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 2, printedClues: 1 },
  locationRule: { concealedFightEvadeBonus: 2 },
}
