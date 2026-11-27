// 09603 哈瓦那大剧院 · 地点（dancingMad）
const modifierKey = id => `09603:shroudTurn:${id}`

export default {
  code: '09603',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 4, printedClues: 1 },
  modifiers: [{
    target: 'locationShroud',
    amount: ({ state, entity }) => {
      const turn = state.scenarioFlags?.[modifierKey(entity.id)]
      return turn != null && turn === state.turnSerial && state.phase === 'investigation'
        && !state.investigators[state.currentSeat]?.turnEnded ? -2 : 0
    },
  }],
  abilities: [{
    kind: 'free', actionKind: 'activate', range: 'here',
    label: '花费 2 个资源：哈瓦那大剧院的隐藏值降低 2，直到你的回合结束',
    cost: { resources: 2 },
    limit: { scope: 'perTurn' },
    criteria: ({ state, inv, source }) => source.revealed && inv.location === source.id
      && state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded,
    resolve: ({ state, source, api }) => api.setScenarioFlag(modifierKey(source.id), state.turnSerial),
  }],
}
