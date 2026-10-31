// 06269 · 《无归之地》诡计「夺命猛火」（Lit by Death-Fire ×2）。
// 卡面：Revelation - Each investigator loses 1 resource. Each investigator at a [[Vale]] or [[Depths]]
//   location chooses and discards 1 card from their hand. Each investigator at a [[Depths]] location
//   loses 1 action.
//
// 全部效果都是既有原语：api.loseResources / api.discardChosen / api.loseActions（无直写状态）。

const activeInvestigators = state => (state?.investigators || [])
  .filter(inv => !inv.defeated && !inv.resigned)

const locationOf = (state, id) => (state?.locations || []).find(entry => entry.id === id) || null

const traitsOf = location => new Set((location?.traits || []).map(trait => String(trait).toLowerCase()))

export default {
  code: '06269',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    for (const target of activeInvestigators(state)) {
      api.loseResources?.(target.seat, 1)
      const location = locationOf(state, target.location)
      const traits = traitsOf(location)
      if ((traits.has('vale') || traits.has('depths')) && (target.hand || []).length > 0) {
        api.discardChosen?.(target.seat, 1, '06269')
        api.info?.(`🔥 ${target.name} 在「${location?.name || ''}」选择并弃掉 1 张手牌。`)
      }
      if (traits.has('depths')) {
        api.loseActions?.(target.seat, 1)
        api.info?.(`🔥 ${target.name} 在「${location?.name || ''}」失去 1 个行动。`)
      }
    }
    return false
  },
}
