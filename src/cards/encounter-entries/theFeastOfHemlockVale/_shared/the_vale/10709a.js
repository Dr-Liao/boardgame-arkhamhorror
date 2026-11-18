// 10709a 阿特伍德宅 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10709a）：[[毒堇谷]]。白日面。帷幕 4，线索 0，连接符号 ☾ → ◆ / ▲ / ♥。
//   [action]：你接近了这座老宅（[codex] 13）。
//
// 读点（数据型条目，规则在章节层）：摆面/连接同 10705a；[codex] 13 在序曲 behavior 的地点行动读点。
export default {
  code: '10709a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10709b',
    printedShroud: 4, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'moon', connectsTo: ['diamond', 'triangle', 'heart'],
    codexNumber: 13,
    actionCodex: 13,
  },
  note: '数据型地点条目：印刷数值与符号供章节 definition 读取，[codex] 13 在序曲 behavior。',
  abilities: [],
}
