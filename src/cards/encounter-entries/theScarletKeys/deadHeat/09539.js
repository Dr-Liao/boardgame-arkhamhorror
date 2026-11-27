// 09539 奴仆
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：每轮抽到的第一张奴仆获得涌动。
// [fast] 你的回合内：尝试躲避奴仆。本次躲避它获得警戒（每回合一次）。
//
// 每轮第一张抽取牌的涌动由章节遭遇牌钩子处理。
export default {
  code: '09539',
  scope: 'enemy',
  implemented: true,
  flags: {
    thrall: true,
    firstDrawnEachRoundGainsSurge: true,
    fastEvadeAction: true,
    alertOnThisEvade: true,
  },
  abilities: [{
    kind: 'free', actionKind: 'evade', range: 'here',
    label: '尝试躲避奴仆，本次躲避它获得警戒',
    limit: { scope: 'perTurn' },
    criteria: ({ state, inv, source }) => state.phase === 'investigation' && state.currentSeat === inv.seat
      && !inv.turnEnded && !source.defeated && source.location === inv.location && source.evade != null,
    resolve: ({ inv, source, api }) => api.evade(inv.seat, {
      enemyId: source.id, ignoreEngagement: true, grantAlert: true, sourceCode: '09539',
    }),
  }],
}
