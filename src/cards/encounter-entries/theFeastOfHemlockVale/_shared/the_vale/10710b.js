// 10710b 泰德杂货店 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10710b）：[[毒堇谷]]。黑夜面。帷幕 4，线索 0，连接符号 ■ → ◆ / ★。
//   泰德杂货店的敌人得到 +1 攻击值。
//   [reaction] 在一个引线放置到本地点后：额外放置 1 个引线。（团队每轮仅限一次。）
//
// 读点（数据型条目，规则在章节层）：敌人 +1 攻击值走章节 behavior 的 enemyStatModifier('fight')；
//   「引线」（kindling）是 fateOfTheVale 幕 3a v.III 的机制（该章 behavior.placeKindling）。
export default {
  code: '10710b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10710a',
    printedShroud: 4, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'square', connectsTo: ['diamond', 'star'],
    enemyFightBonusHere: 1,
    reactionAfterKindlingPlaced: { additionalKindling: 1, groupLimit: 'oncePerRound' },
  },
  note: '数据型地点条目：敌人 +1 攻击值读点 behavior.enemyStatModifier；引线追加读点 fateOfTheVale 的 placeKindling。',
  abilities: [],
}
