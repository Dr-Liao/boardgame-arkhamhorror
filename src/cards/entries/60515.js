export default {
  code: '60515',
  abilities: [{
    kind: 'reaction',
    fromHand: true,
    quickEvent: true,
    trigger: 'skillTestFail',
    label: '检定失败后：你的每项技能 +1，直到本轮结束',
    criteria: ({ state, inv }) => state.skillTest?.seat === inv.seat,
    resolve: ({ api, inv }) => api.addEffect({
      sourceCode: '60515',
      controllerSeat: inv.seat,
      duration: 'endOfRound',
      modifiers: [{ target: 'skill:*', amount: 1 }],
    }),
  }],
}
