// 60231 远见
// 卡面：[fast]你的回合期间，如果你有至少8张手牌，横置远见：打出你手牌中的一张事件(支付其费用)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '60231',
  abilities: [{
    kind: 'free',
    cost: { exhaust: true },
    label: '你的回合手牌至少 8 张：横置并支付费用打出手牌事件',
    criteria: [ownTurn(), ({ inv, helpers }) => inv.hand.length >= 8
      && helpers.playHandCardOptions(inv.seat, { type: 'event' }).length > 0],
    resolve: ({ inv, api }) => {
      const events = api.playHandCardOptions(inv.seat, { type: 'event' })
      if (!events.length) return
      const event = events.length === 1 ? events[0] : api.choice({
        kind: 'card', source: '60231', seat: inv.seat, prompt: '选择要打出的事件。',
        options: events.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
      })
      api.playAsEffect(inv.seat, event)
    },
  }],
}
