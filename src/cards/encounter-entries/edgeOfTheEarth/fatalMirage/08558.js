// 08558 菲奥多西亚号甲板
export default {
  code: '08558', scope: 'location', implemented: true,
  flags: { mirageId: 'deckOfTheTheodosia', tier: 1 },
  locationRule: {
    beforeInvestigate(state, inv, location, api) {
      const options = [{ id: 'shroud', label: '本次调查的帷幕 +2' }]
      if (inv.actionsLeft > 0) options.push({ id: 'action', label: '额外花费 1 个行动' })
      const choice = options.length === 1 ? 'shroud' : api.choice({ kind: 'effect', source: location.id, seat: inv.seat,
        prompt: '选择调查甲板的附加条件。', options })
      if (choice === 'action' && api.spendAdditionalAction(inv.seat)) return
      return { shroudModifier: 2 }
    },
  },
}
