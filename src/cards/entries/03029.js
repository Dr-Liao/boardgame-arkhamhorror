// 03029 障眼戏法
// 卡面：快速。只能在你回合期间打出。
// 卡面：将你手牌中的一张[[道具]]支援放置入场。当你的回合结束时，如果该支援依然在场，将其返回你手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03029 障眼戏法：把一张物品支援免费放置入场（本回合它不算“打出”）。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '03029',
  playCondition: [
    { when: ownTurn(), message: '只能在自己的回合打出' },
  ],
  abilities: [
    {
      kind: 'played', id: 'sleightOfHand', fast: true, label: '免费放置一张物品支援',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(inv.hand.filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).includes('item')))]
        if (!candidates.length) return
        const code = api.choice({ kind: 'card', source: '03029', seat: inv.seat,
          prompt: '选择一件物品支援放置入场。',
          options: candidates.map(item => ({ id: item, cardCode: item, label: api.cardName(item) })) })
        // 「放置入场」不是「打出」：不触发打出类效果，也不付费用。
        api.putIntoPlay(inv.seat, code)
        api.markSleightOfHand(code)
      },
    },
  ],
  modifiers: [

  ],
}
