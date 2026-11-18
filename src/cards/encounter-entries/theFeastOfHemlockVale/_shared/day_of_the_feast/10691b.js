// 10691b 老磨坊 · 地点（Day of the Feast · 晚上面 [Evening]）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10691b）：[[毒堇谷]]。晚上面。帷幕 4，线索 1，连接符号 ♥ → ◆ / ☾。
//   [action]：你调查了灌木底下到底是什么东西在悉悉索索（[codex] 12）。
//
// 读点（数据型条目，规则在章节层）：preludeTheFinalEvening 用晚上面；[codex] 12 由该章 behavior 的
//   地点行动读点结算（与 the_vale 的 10708a 同一编号的法典）。
export default {
  code: '10691b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'evening', period: 'night', oppositeCode: '10691a', mirrorsCode: '10708b',
    printedShroud: 4, printedClues: 1, printedVictory: 0, cluesFixed: false,
    symbol: 'heart', connectsTo: ['diamond', 'moon'],
    codexNumber: 12,
    actionCodex: 12,
  },
  note: '数据型地点条目：晚上面由 preludeTheFinalEvening 摆出；[codex] 12 在章节 behavior。',
  abilities: [],
}
