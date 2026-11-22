// 90040 被抛弃的孤单（Abandoned and Alone · Advanced）· 中立 · 事件/失误 · 温蒂专属弱点。
//
// 卡面（cards-data 90040）：
//   Advanced.
//   Revelation - Remove all non-weakness cards in your discard pile from the game. If no cards
//     were removed by this effect, shuffle this card back into your deck. Otherwise, take 3 direct horror.
//
// 引擎读点：
//   · 弱点自定义结算：`weakness` 描述子带 `resolve(ctx)` 时由它接管整段揭示结算
//     （weakness.js#resolveWeaknessBody：descriptor.resolve(...) 后直接 return）。
//   · 「从游戏中移除」：`api.removeFromGameCards(codes, options)`（api-misc.js → scenario-runtime），
//     卡号列表从 `inv.discard` 过滤非弱点得到；弱点判定用 cards-data 的 subtype
//     （'weakness' / 'basicweakness'）。
//   · 「没有移除任何卡 → 把本卡洗回牌库」：`api.moveCard({ code, from, to: 'shuffleIntoDeck' })`
//     （api-test.js#moveCard 允许的目的地含 shuffleIntoDeck），from 由本卡当前区域判定
//     （揭示中的弱点可能在 hand，也可能已被引擎放到 discard；两处都按实际包含的区取）。
//   · 「否则受到 3 点直接恐惧」：`api.directHorror(inv.seat, 3)`。

import { ALL_CARDS } from '../cards-data.js'

const code = '90040'
const isWeaknessCode = cardCode => {
  const subtype = String(ALL_CARDS[cardCode]?.subtype || '').toLowerCase()
  return subtype.includes('weakness')
}

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：将所有非弱点弃牌从游戏中移除；未移除则洗回牌库，否则受 3 点直接恐惧',
      weakness: { type: 'abandonedAndAloneAdvanced' },
      resolve: ({ inv, api }) => {
        const nonWeakness = [...new Set((inv.discard || []).filter(cardCode => !isWeaknessCode(cardCode)))]
        if (nonWeakness.length) {
          api.removeFromGameCards(nonWeakness, { seat: inv.seat })
          api.info(`「被抛弃的孤单」将 ${nonWeakness.length} 张非弱点弃牌从游戏中移除。`)
          api.directHorror(inv.seat, 3)
          return
        }
        const from = inv.hand.includes(code) ? 'hand' : (inv.discard.includes(code) ? 'discard' : null)
        if (from) api.moveCard({ code, from, to: 'shuffleIntoDeck' }, { seat: inv.seat })
        api.info('「被抛弃的孤单」：弃牌堆没有可移除的非弱点卡牌，改为洗回你的牌库。')
      },
    },
  ],
  modifiers: [],
}
