// 02100 异界放逐
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：the_beyond
// 卡面：显现 - 选择你控制的一个非剧情支援，将其混洗入你的牌库，并从你的牌库顶弃掉3张卡牌。如果弃掉了该支援的同名卡牌，受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '02100', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const assets = inv.assets.filter(asset => !state.scenario.storyAssets?.[asset.code]
      && !ALL_CARDS[asset.code]?.permanent)
    if (!assets.length) return false
    const choice = api.choose({ kind: 'target', source: code, seat: inv.seat,
      prompt: '选择一张非剧情支援洗入牌库，然后弃掉牌库顶 3 张。',
      options: assets.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
    const returned = api.shuffleAssetIntoDeck(inv.seat, choice)
    if (api.discardTop(inv.seat, 3).includes(returned)) api.horror(inv.seat, 2)
    return false
  },
}
