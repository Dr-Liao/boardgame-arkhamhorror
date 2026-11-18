// 10707b 毒堇教堂 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10707b）：[[毒堇谷]]。黑夜面。帷幕 4，线索 1，连接符号 ▲ → ◆ / ☾。
//   强制 - 在毒堇教堂上最后的线索被发现后：在场上每个地点放置 1 个线索。（每场游戏最多一次。）
//   [action]：治愈 1 点恐惧。将你弃牌堆中一张[[法术]]卡牌返回你的手牌。（每场游戏仅限一次。）
//
// 读点（数据型条目，规则在章节层）：「最后线索被发现」走引擎 cluesRemoved 窗口（behavior.cluesRemoved，
//   theLongestNight 的 10636 同一口径）；两项每场一次的限次由章节 behavior 记账；本条目声明触发与数值。
export default {
  code: '10707b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10707a',
    printedShroud: 4, printedClues: 1, printedVictory: 0, cluesFixed: false,
    symbol: 'triangle', connectsTo: ['diamond', 'moon'],
    forcedAfterLastClue: { placeClueOnEachLocation: 1, limit: 'oncePerGame' },
    actionHealHorrorReturnSpell: { horror: 1, trait: 'Spell', limit: 'oncePerGame' },
  },
  note: '数据型地点条目：「最后线索」读点 behavior.cluesRemoved（引擎 cluesRemoved 窗口）；限次由章节 behavior 记账。',
  abilities: [],
}
