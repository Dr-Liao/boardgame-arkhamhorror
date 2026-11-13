// 09086 惊悚皈依（Eldritch Initiation）· 秘术师事件 · 0 经验。
// 卡面：你每有一个法术槽位，抽取 1 张卡牌（最多 5 张）。你每有一个法术槽位有支援，
//       选择并弃掉你 1 张手牌。
//
// 读点：api.drawCards / api.discardFromHand；法术槽位按印在支援卡面的 slots 判定占用法术槽。
//
// approximation（已写 primitive-request/09086.json）：引擎没有公开的「槽位容量读数」API，
// 基础法术槽按调查员通用的 2 个计算；由其它卡授予的额外法术槽（add:slot）未计入。
import { ALL_CARDS } from '../../cards/cards-data.js'

const arcaneSlots = () => 2
const occupiedArcane = inv => (inv.assets || []).reduce((total, asset) => {
  const slots = ALL_CARDS[asset.code]?.slots || []
  let count = 0
  for (const slot of slots) {
    const key = String(slot).trim().toLowerCase()
    if (key === 'arcane') count += 1
    else if (key === 'arcane x2') count += 2
  }
  return total + count
}, 0)

export default {
  code: '09086',
  simplified: true,
  note: 'approximation: 见 primitive-request/09086.json（引擎无槽位容量读数，基础法术槽按 2 计，其它卡授予的额外法术槽未计入）',
  abilities: [
    {
      kind: 'played',
      label: '每个法术槽位抽 1 张（最多 5）；每个被占用的法术槽位弃 1 张手牌',
      resolve: ({ state, inv, api }) => {
        const slots = arcaneSlots()
        const drawCount = Math.min(5, slots)
        let drawn = 0
        for (const text of api.drawCards(inv.seat, drawCount) || []) {
          api.info(text)
          drawn += 1
        }
        if (!drawn) api.info(`📖 「惊悚皈依」：抽取 ${drawCount} 张卡牌。`)
        const filled = occupiedArcane(inv)
        for (let index = 0; index < filled; index++) {
          const hand = state.investigators[inv.seat]?.hand || []
          if (!hand.length) break
          const picked = hand.length === 1 ? hand[0] : api.choice({
            kind: 'discard', source: '09086', seat: inv.seat,
            prompt: `被占用的法术槽位：选择并弃掉第 ${index + 1} 张手牌。`,
            options: [...new Set(hand)].map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
          })
          if (!picked) break
          api.discardFromHand(inv.seat, picked)
          api.info(`🔥 「惊悚皈依」：弃掉「${api.cardName(picked)}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
