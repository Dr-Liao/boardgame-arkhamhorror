// 12074 猎人直觉（Hunter's Instinct）
// 卡面：每位调查员仅限 1 张。使用(3 补给)。如果猎人直觉上没有补给，将其弃掉。
//       [reaction]你与敌人交战后，花费 1 补给并横置猎人直觉：将一张等级 0 的事件从你的弃牌堆加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「使用(3 补给/无补给弃掉)」= 条目级 uses/usesType/discardWhenEmpty（newPlayerAssetInstance /
//     executeDescriptor 的既有读点）；「每位调查员仅限 1 张」= limitPerInvestigator；
//   · 「与敌人交战后」= enemyEngaged 窗口（enemies.js#engageEnemy；context.seat 是交战者）；
//   · 费用 = cost { exhaust, uses: 1 }（能力面统一的费用求值/扣费）；
//   · 弃牌堆→手牌 = api.moveCard({ from: 'discard', to: 'hand' })（06165 同一读点）；等级 0 读
//     cards-data 的 xp（卡面唯一事实源）。

import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '12074'

const levelZeroEvent = code => (ALL_CARDS[code]?.xp ?? null) === 0
  && ALL_CARDS[code]?.type === 'event'

export default {
  code: CODE,
  limitPerInvestigator: true,
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemyEngaged',
      label: '与敌人交战后：花 1 补给并横置，把弃牌堆一张等级 0 事件加入手牌',
      cost: { exhaust: true, uses: 1 },
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.discard || []).filter(levelZeroEvent))]
        if (!candidates.length) {
          api.info('「猎人直觉」：弃牌堆里没有等级 0 的事件卡。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '选择弃牌堆里的一张等级 0 事件加入手牌。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(picked) ? picked : candidates[0]
        api.moveCard({ code, from: 'discard', to: 'hand', ownerSeat: inv.seat })
        api.info(`🏹 「猎人直觉」：${inv.name} 把「${api.cardName(code)}」从弃牌堆加入手牌。`)
      },
    },
  ],
  modifiers: [],
}
