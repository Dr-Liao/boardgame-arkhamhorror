// 10706a 十字路口 · 地点（The Vale · 白日面 [day]，[[中心]]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10706a）：[[毒堇谷]]。[[中心]]。白日面。帷幕 2，线索 0，连接符号 ◆ →
//   ▲ / ■ / ★ / ● / ♥ / ☾（默认起始地点）。
//   [action]：你跟当地人问起山谷的事情（[codex] 10）。
//   [free] 如果游戏中正好有 1 或 2 位调查员，在你的回合期间：移动（至一个连接地点）。（团队每轮仅限一次。）
//
// 读点（数据型条目，规则在章节层）：摆面/连接同 10705a；起始地点由各章 definition 的 START_LOCATION 指定
//   （welcomeToHemlockVale / preludeTheFinalEvening 都用十字路口），中心标记供引擎 loc.central 读点。
export default {
  code: '10706a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale', 'Central'],
    side: 'day', period: 'day', oppositeCode: '10706b',
    printedShroud: 2, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'diamond',
    connectsTo: ['triangle', 'square', 'star', 'circle', 'heart', 'moon'],
    central: true,
    codexNumber: 10,
    actionCodex: 10,
    freeMoveIfOneOrTwoInvestigators: { duringOwnTurn: true, groupLimit: 'oncePerRound' },
  },
  note: '数据型地点条目：中央/连接/法典编号是章节 definition 与序曲 behavior 的读点。',
  abilities: [],
}
