// 02133 展厅
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：强制 - 在你调查本地点时技能检定失败后：弃掉一个你控制的支援。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 59 轮：敦威治后段章节的地点「检定失败」规则（entry 由 tests.js 统一派发）。

import { ALL_CARDS, originalOf } from '../../_shared.js'

export default {
  code: '02133', scope: 'location',
  locationRule: {
    onTestFail(state, loc, api, inv, result) {
      if (result.source?.label !== '调查' || !inv.assets.length) return
      const choice = api.choose({ kind: 'target', source: originalOf(loc), seat: inv.seat,
        prompt: '选择弃掉一张受你控制的支援卡。',
        options: inv.assets.map(asset => ({ id: asset.id, label: asset.name || ALL_CARDS[asset.code]?.nameZh || asset.code })) })
      api.discardAsset(inv.seat, choice)
    },
  },
}
