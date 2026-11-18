// 10711b 山谷学校 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10711b）：[[毒堇谷]]。黑夜面。帷幕 4，线索 0，连接符号 ♠ → ★ / ●。
//   山谷学校的敌人得到 +1 躲避值。
//   [action]：检定[意志]或[敏捷](3)。如果你检定成功，治愈本地点的一位调查员或一个[[盟友]]支援
//     1 点伤害或 1 点恐惧。（每轮仅限一次。）
//
// 读点（数据型条目，规则在章节层）：敌人 +1 躲避值走章节 behavior 的 enemyStatModifier('evade')；
//   治愈行动由章节 behavior 的地点行动读点（每轮一次）。
export default {
  code: '10711b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10711a',
    printedShroud: 4, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'spade', connectsTo: ['star', 'circle'],
    enemyEvadeBonusHere: 1,
    actionTest: { skills: ['willpower', 'agility'], difficulty: 3 },
    onSuccessHealAtLocation: { amount: 1, damageOrHorror: true, targets: ['investigator', 'ally'], limit: 'oncePerRound' },
  },
  note: '数据型地点条目：躲避值修正读点 behavior.enemyStatModifier 的 evade 项；治愈行动在章节 behavior。',
  abilities: [],
}
