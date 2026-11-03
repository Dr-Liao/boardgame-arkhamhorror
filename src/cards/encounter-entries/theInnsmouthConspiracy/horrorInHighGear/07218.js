import { failedBy } from '../../_shared.js'

export default {
  code: '07218',
  scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      const count = failedBy(result, 4)
      if (count === 0) return
      const vehicleId = api.mechanics.vehicles.of(inv.seat)
      const passengers = vehicleId
        ? [...(state.scenarioFlags.mechanics.vehicles[vehicleId]?.passengers || [])]
        : [inv.seat]
      for (const seat of passengers) {
        const investigator = state.investigators[seat]
        if (!investigator || investigator.defeated || investigator.resigned) continue
        const assets = investigator.assets.filter(asset => api.canDiscardAsset(seat, asset.id))
        // 复用现有隐私手牌查询；canDiscardFromHand 的当前策略正是不能弃隐私牌。
        const hasHand = investigator.hand.some(code => !api.hiddenCards.has(seat, code))
        const options = []
        if (assets.length) options.push({ id: 'asset', label: '弃掉一张你控制的支援' })
        if (hasHand) options.push({ id: 'hand', label: `弃掉${count}张手牌（不足则尽量弃掉）` })
        if (!options.length) continue
        const choice = options.length === 1 ? options[0].id : api.choose({
          kind: 'effect', source: card.id || '07218', seat,
          prompt: '树林中的眼睛：选择如何承受检定失败。', options,
        })
        if (choice === 'hand') api.discardChosen(seat, count, '07218')
        else {
          const id = assets.length === 1 ? assets[0].id : api.choose({
            kind: 'asset', source: card.id || '07218', seat,
            prompt: '选择弃掉一张你控制的支援。',
            options: assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code), cardCode: asset.code })),
          })
          api.discardAsset(seat, id)
        }
      }
    })
    return false
  },
}
