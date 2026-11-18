// 10690a 十字路口 · 地点（Day of the Feast · 早晨面 [Morning]）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast（dawnOfTheFinalDay 与 preludeTheFinalEvening
//   都用这一对双面地点）。
// 卡面（cards-data 10690a）：[[毒堇谷]]。[[中心]]。早晨面。帷幕 3，线索 0，连接符号 ◆ →
//   ▲ / ■ / ★ / ● / ♥ / ☾。
//   [action]：你跟当地人问起山谷的事情（[codex] 10）。
//   [free] 如果游戏中正好有 1 或 2 位调查员，在你的回合期间：移动（至一个连接地点）。（团队每轮仅限一次。）
//
// 读点（数据型条目，规则在章节层）：面选择（早晨/晚上）由章节 definition 的双面摆法决定
//   （dawnOfTheFinalDay 用早晨面、preludeTheFinalEvening 用晚上面）；[codex] 10 与免费移动在序曲
//   behavior 的地点行动读点（与 the_vale 的 10706a 同一条印刷文本，规则实现只写一次）。
export default {
  code: '10690a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale', 'Central'],
    side: 'morning', period: 'day', oppositeCode: '10690b', mirrorsCode: '10706a',
    printedShroud: 3, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'diamond',
    connectsTo: ['triangle', 'square', 'star', 'circle', 'heart', 'moon'],
    central: true,
    codexNumber: 10,
    actionCodex: 10,
    freeMoveIfOneOrTwoInvestigators: { duringOwnTurn: true, groupLimit: 'oncePerRound' },
  },
  note: '数据型地点条目：与 the_vale 的 10706a 印刷同文（早晨面）；面选择与法典/免费移动在章节 definition/behavior。',
  abilities: [],
}
