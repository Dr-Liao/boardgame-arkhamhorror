import { ALL_CARDS } from '../../_shared.js'

const printedCost = asset => Math.max(0, Number(ALL_CARDS[asset.originalCode || asset.code]?.cost) || 0)
export default {
  code: '07335', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const shroud = Math.max(0, api.locationShroud(inv.location, inv.seat) ?? 0)
    const discardable = () => state.investigators[inv.seat].assets.filter(asset => api.canDiscardAsset(inv.seat, asset.id))
    const candidates = discardable()
    const options = [
      ...(api.mechanics.water.canChange(inv.location, 1) ? [{ id: 'flood', label: '提升所在地点的淹没等级' }] : []),
      ...(candidates.length && candidates.reduce((sum, asset) => sum + printedCost(asset), 0) >= shroud
        ? [{ id: 'discard', label: `弃掉资源费用合计至少为${shroud}的支援` }] : []),
    ]
    if (!options.length) return false
    const choice = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '07335', seat: inv.seat,
      prompt: '选择提升淹没等级，或弃掉支援。', options,
    })
    if (choice === 'flood') api.mechanics.water.change(inv.location, 1)
    else {
      let discardedCost = 0
      while (discardedCost < shroud) {
        const remaining = discardable()
        if (!remaining.length) break
        const id = api.choice({ kind: 'card', source: '07335', seat: inv.seat,
          prompt: `继续弃掉支援：还需${shroud - discardedCost}点资源费用。`,
          options: remaining.map(asset => ({ id: asset.id, cardCode: asset.code, label: ALL_CARDS[asset.code]?.nameZh || asset.code })),
        })
        const asset = remaining.find(asset => asset.id === id)
        if (!asset) break
        const cost = printedCost(asset)
        if (api.discardAsset(inv.seat, id)) discardedCost += cost
        else break
      }
    }
    return false
  },
}
