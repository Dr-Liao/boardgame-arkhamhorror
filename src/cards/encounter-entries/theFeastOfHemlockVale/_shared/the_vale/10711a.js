// 10711a 山谷学校 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10711a）：[[毒堇谷]]。白日面。帷幕 3，线索 0，连接符号 ♠ → ★ / ●。
//   [action]：你在学校的图书馆里仔细翻阅（[codex] 15）。
//   [action]：查找你的牌库，找出一张[[书籍]]支援并将其抽取。混洗你的牌库。（每场游戏仅限一次。）
//
// 读点（数据型条目，规则在章节层）：[codex] 15 与 [[书籍]] 检索在序曲 behavior 的地点行动读点。
export default {
  code: '10711a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10711b',
    printedShroud: 3, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'spade', connectsTo: ['star', 'circle'],
    codexNumber: 15,
    actionCodex: 15,
    searchDeckForTrait: { trait: 'Tome', limit: 'oncePerGame' },
  },
  note: '数据型地点条目：黑桃符号不在共享 SYMBOLS 表里，章节 definition 自补（welcomeToHemlockVale 的 PRELUDE_SYMBOLS.spade）。',
  abilities: [],
}
