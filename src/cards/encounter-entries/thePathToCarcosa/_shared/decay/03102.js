// 03102 锈蚀
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：decay
// 卡面：显现 - 从你游戏区域和/或你手牌中弃掉一定数量的[[道具]]支援，且这些卡牌上的印刷资源费用总计至少为X，其中X为你所在地的隐藏值。如果没有因本效果弃掉的卡牌，锈蚀获得涌动。(FAQ，v1.2)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '03102', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const location = state.locations.find(candidate => candidate.id === inv.location)
    // X = 所在地点的隐藏值（含本回合的隐藏值修正与 03101 的全局 +1 帷幕）。
    const x = Math.max(0, (location?.shroud || 0) + (location?.shroudMod || 0) + (state.fogMod || 0))
    const isItem = candidate => ALL_CARDS[candidate]?.traits?.includes('Item')
    const assets = inv.assets.filter(asset => isItem(asset.code)
      && !asset.cannotLeavePlay && !ALL_CARDS[asset.code]?.permanent)
    const handItems = () => inv.hand.map((cardCode, index) => ({ cardCode, index }))
      .filter(entry => isItem(entry.cardCode))
    const totalItemsCost = () => assets.reduce((sum, asset) => sum + (ALL_CARDS[asset.code]?.cost || 0), 0)
      + handItems().reduce((sum, entry) => sum + (ALL_CARDS[entry.cardCode]?.cost || 0), 0)
    api.info?.(`锈蚀：需要弃掉印刷费用合计至少 ${x} 点的[[道具]]（场上 ${assets.length} 张，手牌 ${handItems().length} 张）。`)
    if (x <= 0 || totalItemsCost() < x) {
      // 弃不够时不能只弃一部分充数：本次效果没有弃掉任何卡牌 → 涌动。
      api.info?.('锈蚀：没有足够的道具可弃，本次效果没有弃掉任何卡牌，本卡获得涌动。')
      api.drawEncounter(inv.seat)
      return false
    }
    let remaining = x
    let discarded = 0
    while (remaining > 0) {
      const currentHandItems = handItems()
      const options = [
        ...assets.map(asset => ({ id: `asset:${asset.id}`, cost: ALL_CARDS[asset.code]?.cost || 0,
          label: `${ALL_CARDS[asset.code]?.nameZh || asset.code}（${ALL_CARDS[asset.code]?.cost || 0} 资源，场上）` })),
        ...currentHandItems.map(entry => ({ id: `hand:${entry.index}`, cost: ALL_CARDS[entry.cardCode]?.cost || 0,
          label: `${ALL_CARDS[entry.cardCode]?.nameZh || entry.cardCode}（${ALL_CARDS[entry.cardCode]?.cost || 0} 资源，手牌）` })),
      ]
      if (!options.length) break
      const choice = api.choose({
        kind: 'discard-asset', source: code, seat: inv.seat,
        prompt: `锈蚀：选择弃掉一张道具（还需合计 ${remaining} 点印刷费用）。`,
        options: options.map(option => ({ id: option.id, label: option.label })),
      })
      const picked = options.find(option => option.id === choice) || options[0]
      if (String(picked.id).startsWith('hand:')) {
        const index = Number(String(picked.id).slice(5))
        const [cardCode] = inv.hand.splice(index, 1)
        if (cardCode) inv.discard.push(cardCode)
      } else {
        const assetId = String(picked.id).slice(6)
        const asset = assets.find(item => item.id === assetId)
        if (asset) {
          assets.splice(assets.indexOf(asset), 1)
          api.discardAsset(inv.seat, asset.id)
        }
      }
      remaining -= picked.cost
      discarded++
    }
    if (!discarded) {
      api.info?.('锈蚀：本次效果没有弃掉任何卡牌，本卡获得涌动。')
      api.drawEncounter(inv.seat)
    }
    return false
  },
}
