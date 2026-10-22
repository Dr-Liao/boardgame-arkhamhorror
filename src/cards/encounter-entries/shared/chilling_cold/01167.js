// 01167 地窖寒风
// 归属：跨战役通用
// 遭遇组：chilling_cold
// 卡面：显现 - 检定[willpower](4)。如果你检定失败，选择并弃掉1个你控制的支援(如果你不能，则改为受到2点伤害)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01167', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      const assets = (inv.assets || []).filter(asset => !asset.isStoryAsset)
      if (!assets.length) { api.damage(inv.seat, 2); return }
      const answer = assets.length === 1 ? assets[0].id : api.choose({
        kind: 'asset', source: '01167', seat: inv.seat,
        prompt: '地窖寒风：选择并弃掉 1 个你控制的支援。',
        options: assets.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
      })
      api.discardAsset(inv.seat, (assets.find(asset => asset.id === answer) || assets[0]).id)
    })
    return false
  },
}
