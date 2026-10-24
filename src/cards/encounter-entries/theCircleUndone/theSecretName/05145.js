// 05145 异次元幻象（Extradimensional Visions）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 检定意志(2 + 遭遇弃牌堆每 10 张 +1)；失败弃掉一个你控制的支援。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05145', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const extra = Math.floor((state.encounterDiscard?.length || 0) / 10)
    const difficulty = 2 + extra
    let placed = false
    api.test?.(inv.seat, 'willpower', difficulty, result => {
      if (result?.success) return
      const assets = inv.assets || []
      if (!assets.length) return
      const picked = api.choose?.({
        kind: 'asset', source: '05145', seat: inv.seat,
        prompt: '选择并弃掉一个你控制的支援。',
        options: assets.map(asset => ({ id: String(asset.id), label: ALL_CARDS[originalOf(asset)]?.nameZh || originalOf(asset) })),
      })
      const asset = assets.find(entry => String(entry.id) === String(picked)) || assets[0]
      api.discardAsset?.(inv.seat, asset.id)
      placed = true
    })
    return placed
  },
}
