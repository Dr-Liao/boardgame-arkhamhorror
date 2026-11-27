// 08660 瘴气的召唤 · 议程 2。背面只结算调查员仍控制的封印。
export default {
  code: '08660',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    forced: { anyWindow() { return undefined } },
    onLeave(state, agenda, api) {
      const seals = state.campaign?.eote?.seals?.entries || []
      const controlled = kind => seals.find(seal => seal.kind === kind
        && seal.placedBySeat != null && seal.locationId == null)
      const a = controlled('A')
      if (a) api.damage(a.placedBySeat, a.active ? 2 : 1)
      const b = controlled('B')
      if (b) api.discardRandom(b.placedBySeat, b.active ? 4 : 2)
      const c = controlled('C')
      if (c) api.horror(c.placedBySeat, c.active ? 2 : 1)
      const d = controlled('D')
      if (d) api.loseActions(d.placedBySeat, d.active ? 2 : 1)
      const e = controlled('E')
      if (e) api.loseResources(e.placedBySeat, e.active ? 6 : 3)
    },
  },
}
