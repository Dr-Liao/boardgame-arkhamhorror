// 10707a 毒堇教堂 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10707a）：[[毒堇谷]]。白日面。帷幕 3，线索 0，连接符号 ▲ → ◆ / ☾。
//   [action]：你走向山丘顶端掩埋在植被之下的教堂（[codex] 11）。
//   [action]：查找你牌库顶 9 张卡牌，找出一张[[法术]]卡牌并将其抽取。混洗你的牌库。（每场游戏仅限一次。）
//
// 读点（数据型条目，规则在章节层）：摆面/连接同 10705a；[codex] 11 与「查找牌库顶 9 张」在序曲
//   behavior 的地点行动读点（searchDeck/searchToHand 原语）；本条目只声明印刷数值与检索参数。
export default {
  code: '10707a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10707b',
    printedShroud: 3, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'triangle', connectsTo: ['diamond', 'moon'],
    codexNumber: 11,
    actionCodex: 11,
    searchTopForTrait: { count: 9, trait: 'Spell', limit: 'oncePerGame' },
  },
  note: '数据型地点条目：检索参数（牌库顶 9 / [[法术]] / 每场一次）供序曲 behavior 的地点行动读点。',
  abilities: [],
}
