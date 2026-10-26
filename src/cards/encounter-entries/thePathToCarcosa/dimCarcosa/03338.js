// 03338 疯狂领域
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：显现 - 从你游戏区域和/或你手牌中弃掉一定数量的卡牌，且这些卡牌上的印刷资源费用总计至少为X，其中X为你调查员身上的恐惧数量。(FAQ，v1.4)如果没有因本效果弃掉卡牌，受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '03338', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const code = card?.originalCode || card?.code
    const x = inv.horror || 0
    // X=0：目标已满足，没有「弃牌或受 2 恐惧」的选择。
    if (x <= 0) return false
    let total = 0
    let discarded = 0
    while (total < x) {
      const options = [
        ...inv.hand.map((code, index) => ({ id: `h${index}`, kind: 'hand', code,
          label: `${api.cardName(code)}（${ALL_CARDS[code]?.cost || 0}资源）`, cost: ALL_CARDS[code]?.cost || 0 })),
        ...inv.assets.map((asset, index) => ({ id: `a${index}`, kind: 'asset', code: asset.code, asset,
          label: `${api.cardName(asset.code)}（${ALL_CARDS[asset.code]?.cost || 0}资源）`, cost: ALL_CARDS[asset.code]?.cost || 0 })),
      ]
      if (!options.length) break
      const answer = options.length === 1 ? options[0].id : api.choose({
        kind: 'card', source: code, seat: inv.seat,
        prompt: `弃掉游戏区域/手牌中的卡牌，直到印刷费用合计至少 ${x}（当前 ${total}）。`,
        options: options.map(option => ({ id: option.id, label: option.label })),
      })
      const picked = options.find(option => option.id === answer) || options[0]
      // scenarioRuntime 没有 discardFromHand / choice：手牌直接进弃牌堆，支援走 discardAsset(id)。
      if (picked.kind === 'hand') {
        const handIndex = inv.hand.indexOf(picked.code)
        if (handIndex >= 0) inv.hand.splice(handIndex, 1)
        inv.discard.push(picked.code)
      } else api.discardAsset(inv.seat, picked.asset.id)
      total += picked.cost
      discarded += 1
    }
    if (discarded === 0) api.horror(inv.seat, 2)
    return false
  },
}
