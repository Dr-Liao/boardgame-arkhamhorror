// 10691a 老磨坊 · 地点（Day of the Feast · 早晨面 [Morning]）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10691a，cluesFixed）：[[毒堇谷]]。早晨面。帷幕 4，线索 1（固定值），连接符号 ♥ → ◆ / ☾。
//   [action][action]：发现老磨坊的 1 个线索。
//
// 线索数固定。地点实体行动统一校验并扣除两个行动。
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
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 2 },
    label: '花费 2 个行动，发现老磨坊的 1 个线索',
    criteria: ({ source }) => source.clues > 0,
    resolve: ({ inv, source, api }) => api.discoverClue(inv.seat, 1, source.id),
  }],
}
