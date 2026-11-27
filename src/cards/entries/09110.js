// 09110 救生索（Lifeline）· 幸存者事件 · 1 经验
// 卡面：每回合最多 1 张。
//       快速。在一位调查员的回合将要结束时打出。
//       该调查员可以在自己的回合期间进行额外 X 个行动。X 等于其自己回合期间技能检定失败的次数。放逐救生索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
const code = '09110'
const LIMIT = 'lifelinePlayedTurn'

function failedInTurn(state, seat) {
  const history = state.investigators[seat]?.failedTestsThisTurn
  return history?.turn === state.turnSerial ? history.count : 0
}

export default {
  code,
  trackFailedTestsThisTurn: true,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'turnWouldEnd',
      range: 'anywhere',
      exileAfterPlay: true,
      label: '延长这位调查员的回合，每失败一次技能检定便增加 1 行动，然后放逐本卡',
      criteria: [({ state, context }) => state.scenarioFlags?.[LIMIT] !== state.turnSerial
        && failedInTurn(state, context.seat) > 0],
      resolve: ({ state, context, api }) => {
        const amount = failedInTurn(state, context.seat)
        if (api.extendEndingTurn(context, amount)) api.setScenarioFlag(LIMIT, state.turnSerial)
      },
    },
  ],
  modifiers: [],
}
