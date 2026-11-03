// 06282 受召猎犬
// 卡面：作为打出受召猎犬的额外费用，你必须查找你的绑定卡牌，找出1张脱缰野兽并将其混洗入你的牌库。
//       [free]在你回合期间(行动外)，横置受召猎犬：攻击/调查。
//       以基础值为5的[combat]攻击，或以基础值为5的[intellect]调查。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06282 受召猎犬（绑定主卡，绑定弱点 06283 脱缰野兽）：
//   · 额外打出费用「查找绑定卡牌，把 1 张脱缰野兽洗入牌库」→ bondedShufflePlayCost；
//   · [free] 攻击/调查二选一：写成两条 action/free 描述子（各花横置、无行动点），
//     攻击用 api.fight(...,{ baseValue:5 })（基础战斗值 5），调查用 api.investigate({ baseValue:5 })；
//   · 行动外限制：能力 criteria 的 helpers.isResolvingAction。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '06282',
  bondedShufflePlayCost: { count: 1 },
  abilities: [
    {
      kind: 'free',
      label: '[free] 横置：攻击（基础战斗值 5）',
      cost: { action: false, exhaust: true },
      countsAs: 'fight',
      criteria: [ownTurn(), ({ helpers }) => !helpers.isResolvingAction()],
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, { baseValue: 5, noSpend: true })
      },
    },
    {
      kind: 'free',
      label: '[free] 横置：调查（基础智识值 5）',
      cost: { action: false, exhaust: true },
      criteria: [ownTurn(), ({ helpers }) => !helpers.isResolvingAction()],
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { baseValue: 5 })
      },
    },
  ],
  modifiers: [],
}
