// 08560 树篱迷宫
export default {
  code: '08560', scope: 'location', implemented: true,
  flags: { mirageId: 'hedgeMaze', tier: 2 },
  abilities: [{
    kind: 'forced', trigger: 'testEnds', label: '本回合帷幕 +1，且你不能离开树篱迷宫',
    criteria: ({ state, inv, source, context }) => state.phase === 'investigation'
      && state.currentSeat === inv.seat && context.seat === inv.seat
      && state.skillTest?.actionKind === 'investigate' && state.skillTest?.target?.id === source.id,
    resolve: ({ state, inv, source, api }) => {
      const modifier = source.turnShroudMod
      const total = modifier?.round === state.round && modifier.turnSeat === inv.seat ? modifier.amount || 0 : 0
      api.tempShroudMod(source, total + 1)
      api.addEffect({ sourceCode: '08560', controllerSeat: inv.seat, duration: 'endOfTurn',
        label: '树篱迷宫：本回合不能移动', modifiers: [{ target: 'capability:move' }] })
    },
  }],
}
