// 09744 异世界之触（Touch of the Beyond） · 诡计 · spreading_corruption
// 归属：战役共用 · theScarletKeys/_shared/spreadingCorruption。
// 卡面：显现 - 在你控制的印刷资源费用最高的支援上放置 1 个毁灭标记。
//   如果未因本效果放置毁灭标记，异世界之触获得涌动。
//   Revelation - Place 1 doom on the asset you control with the highest printed resource cost. If no doom
//   was placed by this effect, Touch of the Beyond gains surge.
// 读点：
//   · 印刷资源费用 = cards-data 的 cost（_shared.js 的 ALL_CARDS 只读卡表，不读运行时减费）；
//   · 放置毁灭 = api.doomOn（场景运行时的毁灭写入口，走 placeDoomOnCard / doomPlaced 钩子）；
//     能不能放先用 api.canPlaceDoomOn 问同一读点（04265 手铐类拦截）；
//   · 「获得涌动」= 返回 { gainSurge: true }（encounter.js#finishDraw 同源）。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '09744'

const printedCost = asset => {
  const cost = Number(ALL_CARDS[asset?.originalCode || asset?.code]?.cost)
  return Number.isFinite(cost) ? cost : 0
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const assets = (inv.assets || []).filter(asset => !['weakness', 'basicweakness'].includes(ALL_CARDS[asset.code]?.subtype))
    if (!assets.length) {
      api.info?.('🌑 「异世界之触」：你没有支援，获得涌动。')
      return { gainSurge: true }
    }
    const best = Math.max(...assets.map(printedCost))
    const candidates = assets.filter(asset => printedCost(asset) === best)
    const target = candidates.length === 1 ? candidates[0] : candidates.find(asset => asset.id === api.choose({
      kind: 'asset', source: CODE, seat: inv.seat,
      prompt: '异世界之触：选择印刷资源费用最高（并列）的支援放置 1 个毁灭。',
      options: candidates.map(asset => ({ id: asset.id, label: `${api.cardName(asset.code)}（费用 ${printedCost(asset)}）` })),
    })) || candidates[0]
    if (!target || api.canPlaceDoomOn(target) === false) {
      api.info?.('🌑 「异世界之触」：毁灭不能放在该支援上，获得涌动。')
      return { gainSurge: true }
    }
    api.doomOn(target, 1)
    api.info?.(`🌑 「异世界之触」：在「${api.cardName(target.code)}」上放置 1 个毁灭。`)
    return false
  },
  note: 'approximation: 「印刷资源费用」读 cards-data 的 cost；放置前的可行性走 api.canPlaceDoomOn（与毁灭放置钩子同一读点）。'
    + '无缺读点。',
}
