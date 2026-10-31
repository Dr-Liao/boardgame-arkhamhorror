// 06282 受召猎犬
// 卡面：作为打出受召猎犬的额外费用，你必须查找你的绑定卡牌，找出1张脱缰野兽并将其混洗入你的牌库。
//       [free]在你回合期间(行动外)，横置受召猎犬：攻击/调查。
//       以基础值为5的[combat]攻击，或以基础值为5的[intellect]调查。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06282 受召猎犬（绑定主卡，绑定弱点 06283 脱缰野兽）：
//   · 额外费用「查找绑定卡牌，把 1 张脱缰野兽洗入牌库」→ entersPlay 生命周期钩子 +
//     api.bonded.retrieve(seat,'06282',{ handCount:0 })（P2.8 绑定原语：不入手、全部洗回牌库）；
//   · [free] 攻击/调查二选一：写成两条 action/free 描述子（各花横置、无行动点），
//     攻击用 api.fight(...,{ baseValue:5 })（基础战斗值 5），调查用 api.investigate({ baseValue:5 })；
//   · 显式简化：卡面「行动外」的限制没有引擎读点（引擎无「正在结算行动」的读点），未实现该限制。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '06282',
  simplified: true,
  note: '未实现：卡面「行动外（except during an action）」的使用限制——引擎没有「是否正在结算一次行动」的'
    + '通用读点，现允许在任意时点（自己回合内）横置发动。其余效果（额外费用检索脱缰野兽洗回牌库、'
    + '基础值 5 的攻击/调查）已实现。',
  abilities: [
    {
      kind: 'entersPlay',
      label: '额外费用：查找绑定卡牌，把 1 张脱缰野兽洗入你的牌库',
      resolve: ({ inv, api }) => {
        api.bonded.retrieve(inv.seat, '06282', { handCount: 0 })
      },
    },
    {
      kind: 'action',
      label: '[free] 横置：攻击（基础战斗值 5）',
      cost: { action: false, exhaust: true },
      countsAs: 'fight',
      criteria: [ownTurn()],
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, { baseValue: 5, noSpend: true })
      },
    },
    {
      kind: 'action',
      label: '[free] 横置：调查（基础智识值 5）',
      cost: { action: false, exhaust: true },
      criteria: [ownTurn()],
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { baseValue: 5 })
      },
    },
  ],
  modifiers: [],
}
