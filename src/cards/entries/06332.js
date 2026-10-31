// 06332 拾荒
// 卡面：[reaction]在你成功调查，且超过难度至少2点后，横置拾荒：在你的弃牌堆中选择一张[[道具]]卡牌，
//       将其加入你的手中或打出(支付其费用)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06332 拾荒（[[才能]]支援）：
//   · [reaction]「成功调查且超过难度至少 2 点后」→ 旧式反应通道 trigger 'investigateSuccess'
//     + criteria.successByAtLeast:2（triggerReaction 的上下文带 successBy，读点唯一）；
//   · 横置自身作费用 → cost:{ exhaust:true }；
//   · 弃牌堆选一张[[道具]]卡牌，加入手中或打出（支付费用）→ resolve 里按卡面数据筛出弃牌堆中的道具卡，
//     api.choice 选择；加入手牌用 api.moveCard(discard→hand)，打出用 moveCard(discard→hand) 后
//     api.playCard（正常付费/入场/窗口）。
//   · 旧式反应每场调查成功窗口只结算一次（不会像纯描述子反应那样被反复点击）。

import { ALL_CARDS } from '../../cards/cards-data.js'

function itemCandidates(inv) {
  return [...new Set((inv?.discard || []).filter(code => {
    const def = ALL_CARDS[code]
    return Boolean(def) && def.type === 'asset'
      && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
  }))]
}

export default {
  code: '06332',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'investigateSuccess',
      id: 'scavenging',
      legacyReaction: true,
      label: '成功调查且超过难度至少 2 点：横置拾荒，从弃牌堆取回/打出 1 张[[道具]]',
      criteria: { successByAtLeast: 2 },
      cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        const candidates = itemCandidates(inv)
        if (!candidates.length) { api.info('弃牌堆里没有[[道具]]卡牌。'); return }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '06332', seat: inv.seat,
          prompt: '选择弃牌堆中的一张[[道具]]卡牌。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(chosen) ? chosen : candidates[0]
        const mode = api.choice({
          kind: 'effect', source: '06332', seat: inv.seat,
          prompt: `「${api.cardName(code)}」加入手牌，还是立即打出（支付其费用）？`,
          options: [{ id: 'hand', label: '加入手牌' }, { id: 'play', label: '立即打出' }],
        })
        api.moveCard({ code, from: 'discard', to: 'hand' })
        if (mode === 'play') api.playCard(inv.seat, code)
        api.info(`♻️ ${inv.name} 用「拾荒」把「${api.cardName(code)}」${mode === 'play' ? '打出' : '加入手牌'}。`)
      },
    },
  ],
  modifiers: [],
}
