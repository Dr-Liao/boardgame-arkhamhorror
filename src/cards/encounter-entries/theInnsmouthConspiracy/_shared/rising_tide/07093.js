import { failedBy } from '../../../_shared.js'
export default {
  code: '07093', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const level = api.mechanics.water.level(inv.location)
    if (level === 0) return { gainSurge: true }
    const difficulty = level === 2 ? 4 : 3
    api.test(inv.seat, 'agility', difficulty, result => {
      if (result.success) return
      const assets = state.investigators[inv.seat].assets.filter(asset => api.canDiscardAsset(inv.seat, asset.id))
      if (!assets.length) { api.loseResources(inv.seat, failedBy(result, difficulty)); return }
      const id = assets.length === 1 ? assets[0].id : api.choose({ kind: 'target', seat: inv.seat, source: '07093',
        prompt: '选择弃掉一个你控制的支援。', options: assets.map(asset => ({ id: asset.id, label: asset.name || asset.code, cardCode: asset.code })) })
      if (assets.some(asset => asset.id === id)) api.discardAsset(inv.seat, id)
    })
    return false
  },
}
