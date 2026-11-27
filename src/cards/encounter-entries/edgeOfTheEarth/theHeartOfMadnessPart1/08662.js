// 08662 蛰伏 · 幕 1。将首枚激活封印放到门上后，给放置者对应收益。
export default {
  code: '08662',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'activatedSealOnGate' },
    onLeave(state, act, api) {
      const gate = state.scenario.startLocation
      const seal = api.mechanics.eoteCampaign.seals.at(gate).find(item => item.active && item.placedBySeat != null)
      if (!seal) return
      const seat = seal.placedBySeat
      switch (seal.kind) {
        case 'A': api.healDamage(seat, 1); break
        case 'B': api.drawCards(seat, 2); break
        case 'C': api.healHorror(seat, 1); break
        case 'D': api.gainAction(seat, 1); break
        case 'E': api.gainResources(seat, 3); break
      }
    },
  },
}
