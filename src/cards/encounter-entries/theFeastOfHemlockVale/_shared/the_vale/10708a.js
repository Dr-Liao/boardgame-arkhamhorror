// 10708a 老磨坊 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10708a，cluesFixed）：[[毒堇谷]]。白日面。帷幕 2，线索 1（固定值，不随人数增加），
//   连接符号 ♥ → ◆ / ☾。
//   [reaction] 你发现老磨坊的线索后：（[codex] 12）。
//
// 读点（数据型条目，规则在章节层）：cluesFixed 由 definition 的 location({ cluesFixed: true }) 读；
//   「发现线索后 → 法典」走引擎 clueDiscovered 窗口 + 序曲 behavior 的 codex 读点。
export default {
  code: '10708a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10708b',
    printedShroud: 2, printedClues: 1, printedVictory: 0, cluesFixed: true,
    symbol: 'heart', connectsTo: ['diamond', 'moon'],
    codexNumber: 12,
    reactionAfterDiscoverClue: { codexNumber: 12 },
  },
  note: '数据型地点条目：线索固定值 cluesFixed 由章节 definition 读；法典触发走 clueDiscovered 窗口 + 序曲 behavior。',
  abilities: [],
}
