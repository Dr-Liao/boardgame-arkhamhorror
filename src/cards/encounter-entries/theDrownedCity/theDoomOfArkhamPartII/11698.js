// 11698 南区（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：南区（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined（flags.ruined）。
import { ALL_CARDS, hasTrait } from '../../_shared.js'

const CODE = '11698'
const itemsInDiscard = inv => [...new Set(inv.discard.filter(code =>
  ALL_CARDS[code]?.type === 'asset' && hasTrait(ALL_CARDS[code], 'Item')))]

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { ruined: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', cost: { action: 1 },
    label: '从你的弃牌堆取回一张[[道具]]支援',
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ inv, helpers }) => !helpers.discardLocked() && itemsInDiscard(inv).length > 0,
    resolve: ({ inv, api }) => {
      const items = itemsInDiscard(inv)
      if (!items.length) return
      const code = items.length === 1 ? items[0] : api.choice({
        kind: 'card', source: CODE, seat: inv.seat, prompt: '选择要加入手牌的[[道具]]支援。',
        options: items.map(id => ({ id, cardCode: id, label: api.cardName(id) })),
      })
      api.moveCard({ code, from: 'discard', to: 'hand' }, { seat: inv.seat })
    },
  }],
}
