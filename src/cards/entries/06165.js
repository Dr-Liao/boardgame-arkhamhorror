// 06165 搜刮补给
// 卡面：选择你弃牌堆中一张等级0的卡牌。将所选卡牌加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：候选来自只读 state.investigators[...].discard；等级（xp）来自卡面数据 cards-data
// （ALL_CARDS[code].xp，卡面唯一事实源）；拿回手牌走 api.moveCard(from:'discard', to:'hand')。

import { ALL_CARDS } from '../../cards/cards-data.js'

const levelZero = code => (ALL_CARDS[code]?.xp ?? null) === 0

export default {
  code: '06165',
  abilities: [
    {
      kind: 'played',
      label: '从弃牌堆选择一张等级 0 卡牌加入手牌',
      resolve: ({ state, inv, api }) => {
        const candidates = [...new Set((inv.discard || []).filter(levelZero))]
        if (!candidates.length) { api.info('你的弃牌堆里没有等级 0 的卡牌。'); return }
        const answer = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '06165', seat: inv.seat,
          prompt: '选择弃牌堆中一张等级 0 的卡牌加入手牌。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const picked = candidates.includes(String(answer)) ? String(answer) : candidates[0]
        api.moveCard({ code: picked, from: 'discard', to: 'hand', ownerSeat: inv.seat })
        api.info(`🃏 ${inv.name} 从弃牌堆取回「${api.cardName(picked)}」加入手牌。`)
      },
    },
  ],
  modifiers: [],
}
