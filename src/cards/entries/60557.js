// 60557 独行 · 支援（2 费，意志图标，条件）
// 卡面：每位调查员仅限 1 张。
//       [free]你的回合期间，横置本卡：移动到一个连接的无人地点。
// 读点：[free] 能力 = kind action + cost.action:false + exhaust；target kind location（当前+连接）。
const CODE = '60557'
const ownTurn = ({ state, inv }) => state.currentSeat === inv.seat && state.phase === 'investigation'

export default {
  code: CODE,
  limitPerInvestigator: 1,
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '横置独行：移动到一个连接的无人地点',
    cost: { action: false, exhaust: true },
    criteria: [ownTurn],
    target: { kind: 'location', query: ({ candidate, state }) => {
      if (!candidate?.id) return false
      if (candidate.id === state.investigators[state.currentSeat]?.location) return false
      return !state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === candidate.id)
    } },
    resolve: ({ inv, api, targetId }) => {
      if (!targetId) return
      api.moveInvestigator(inv.seat, targetId)
    },
  }],
  modifiers: [],
}
