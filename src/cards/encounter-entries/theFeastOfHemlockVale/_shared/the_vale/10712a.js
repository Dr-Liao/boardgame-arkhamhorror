// 10712a 集会厅 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10712a）：[[毒堇谷]]。白日面。帷幕 1，线索 0，连接符号 ★ → ◆ / ■ / ♠。
//   [action]：你在村子的社群大厅里仔细检查，想找出当地是怎么和外面互通有无的（[codex] 16）。
//
// 读点（数据型条目，规则在章节层）：[codex] 16 在序曲 behavior 的地点行动读点（[[盟友]] 检索）。
export default {
  code: '10712a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10712b',
    printedShroud: 1, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'star', connectsTo: ['diamond', 'square', 'spade'],
    codexNumber: 16,
    actionCodex: 16,
    searchTopForTrait: { count: 9, trait: 'Ally', limit: 'oncePerGame' },
  },
  note: '数据型地点条目：印刷数值/符号供章节 definition 读取，[codex] 16 在序曲 behavior。',
  abilities: [],
}
