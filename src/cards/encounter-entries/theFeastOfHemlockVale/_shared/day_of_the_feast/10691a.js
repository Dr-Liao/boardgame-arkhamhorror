// 10691a 老磨坊 · 地点（Day of the Feast · 早晨面 [Morning]）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10691a，cluesFixed）：[[毒堇谷]]。早晨面。帷幕 4，线索 1（固定值），连接符号 ♥ → ◆ / ☾。
//   [action][action]：发现老磨坊的 1 个线索。
//
// 读点（数据型条目，规则在章节层）：cluesFixed 由 definition 的 location({ cluesFixed: true }) 读；
//   「两行动发现 1 线索」由章节 behavior 的地点行动读点（成本统一由 api/行动框架扣行动）。
export default {
  code: '10691a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'morning', period: 'day', oppositeCode: '10691b', mirrorsCode: '10708a',
    printedShroud: 4, printedClues: 1, printedVictory: 0, cluesFixed: true,
    symbol: 'heart', connectsTo: ['diamond', 'moon'],
    actionDiscoverClue: { amount: 1, actions: 2 },
  },
  note: '数据型地点条目：线索固定值 cluesFixed；两行动发现线索由章节 behavior 的地点行动读点。',
  abilities: [],
}
