// 10710a 泰德杂货店 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10710a）：[[毒堇谷]]。白日面。帷幕 2，线索 0，连接符号 ■ → ◆ / ★。
//   [action]：谈判。你跟当地人讨价还价，一边聊了起来（[codex] 14）。
//
// 读点（数据型条目，规则在章节层）：[codex] 14 在序曲 behavior（印刷「任何尚未结算此效果的调查员可以再次
//   触发」→ 引擎 codex limit 'unlimited' + 逐调查员记账，见 welcomeToHemlockVale 的 CODEX_ENTRIES[14]）。
export default {
  code: '10710a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10710b',
    printedShroud: 2, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'square', connectsTo: ['diamond', 'star'],
    codexNumber: 14,
    actionCodex: 14,
    parley: true,
    codexLimit: 'unlimited',
    codexPerInvestigatorOnce: true,
  },
  note: '数据型地点条目：14 号法典印刷「每位未结算的调查员可再触发」→ 章节 definition 用 limit:unlimited + 逐座位记账。',
  abilities: [],
}
