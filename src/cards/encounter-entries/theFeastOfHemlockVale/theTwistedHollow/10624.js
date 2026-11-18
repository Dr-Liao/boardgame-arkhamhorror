// 10624 光明遭窃 · 诡计（牌库 1 张）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：险境。显现 - 你必须选择一项：在当前议程上放置 1 个毁灭标记（本效果能导致议程推进）；
//     或将山谷提灯翻至[[熄灭]]面，放置在离所有调查员最远的无人地点。

export default {
  code: '10624',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('theTwistedHollowTreachery', { seat: inv.seat, code: this.code }) === true
  },
  flags: {
    "stolenLight": true,
    "peril": true,
    "failChoice": [
      "placeDoomOnAgendaCanAdvance",
      "lanternToFarthestEmpty"
    ]
  },
  note: "近似：「最远的无人地点」用 BFS 最小距离取最大者；无连接信息时退回当前提灯地点。",
  abilities: [],
}
