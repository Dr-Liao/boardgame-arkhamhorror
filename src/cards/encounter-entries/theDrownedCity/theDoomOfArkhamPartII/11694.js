// 11694 东镇（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：东镇（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 印刷限制：不能完全淹没（水位上限 1，locationRule.floodBounds 引擎读点）。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined / flood.js（flags.ruined 与 floodBounds）。
import { ALL_CARDS, hasTrait } from '../../_shared.js'

const CODE = '11694'
const discardableAllies = (inv, canDiscard) => (inv.assets || []).filter(asset =>
  !asset.facedown && hasTrait(ALL_CARDS[asset.originalCode || asset.code], 'Ally') && canDiscard(asset))

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 1 } },
  flags: { ruined: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', cost: { action: 1 },
    label: '弃掉一张你控制的盟友：降低本地点的淹没等级并抽三张牌',
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ inv, helpers }) => discardableAllies(inv, helpers.canDiscardAsset).length > 0,
    prepay: ({ inv, api }) => {
      const allies = discardableAllies(inv, asset => api.scenario.canDiscardAsset(inv.seat, asset.id))
      if (!allies.length) return false
      const id = allies.length === 1 ? allies[0].id : api.choice({
        kind: 'asset', source: CODE, seat: inv.seat, prompt: '弃掉你控制的一张盟友支援来支付费用。',
        options: allies.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
      })
      return api.scenario.discardAsset(inv.seat, id) ? { discarded: true } : false
    },
    resolve: ({ inv, source, api }) => {
      api.mechanics.water.change(source.id, -1)
      api.drawCards(inv.seat, 3)
    },
  }],
}
