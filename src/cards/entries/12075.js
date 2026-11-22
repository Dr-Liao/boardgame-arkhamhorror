// 12075 连体服（Jumpsuit）
// 卡面：[fast]你的回合期间，弃掉连体服：选择你弃牌堆的一张[[工具]]或[[武器]]支援，将其加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [fast] 支援能力 = kind:'free' + cost { action: false, discardSelf: true }（费用/弃自身的唯一读点）；
//   · 「你的回合期间」= ownTurn() matcher（criteria，与 02108 同口径）；
//   · 弃牌堆→手牌 = api.moveCard({ from: 'discard', to: 'hand' })（06165 同一读点）；
//     支援类型/[[工具]]或[[武器]]特性读 api.cardType/api.cardTraits。

import { ownTurn } from '../../engine/matcher.js'
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '12075'

const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())

const toolOrWeaponAsset = code => ALL_CARDS[code]?.type === 'asset'
  && (traitsOf(code).includes('tool') || traitsOf(code).includes('weapon'))

const inDiscardToolOrWeapon = inv => (inv.discard || []).some(toolOrWeaponAsset)

export default {
  code: CODE,
  abilities: [
    {
      kind: 'free',
      label: '弃置连体服：从弃牌堆把一张[[工具]]或[[武器]]支援加入手牌',
      cost: { action: false, discardSelf: true },
      criteria: [ownTurn(), ({ inv }) => inDiscardToolOrWeapon(inv)],
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.discard || []).filter(toolOrWeaponAsset))]
        if (!candidates.length) {
          api.info('「连体服」：弃牌堆里没有[[工具]]或[[武器]]支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '选择弃牌堆里的一张[[工具]]或[[武器]]支援加入手牌。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(picked) ? picked : candidates[0]
        api.moveCard({ code, from: 'discard', to: 'hand', ownerSeat: inv.seat })
        api.info(`🧥 「连体服」：${inv.name} 把「${api.cardName(code)}」从弃牌堆加入手牌。`)
      },
    },
  ],
  modifiers: [],
}
