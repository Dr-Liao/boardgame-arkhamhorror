// 12104 受伤（Wounded）· 中立 · 诡计/损伤 · 基础弱点。
//
// 卡面：
//   显现 - 将受伤放置入场，位于你的威胁区域。
//   强制 - 你每回合第一次移动：受到 1 点伤害。
//   [action][action]：弃掉受伤。
//
// 引擎读点：
//   · 显现 + 摆脱行动：weakness 描述子的 `{ type: 'threat', discardCost: { action: 2 } }`
//     （同 12102：moves.js/actions-extra.js 统一结算）。
//   · 「你每回合第一次移动」：`move` 窗口（movement.js#relocateInvestigatorCore 在调查员移动后
//     triggerReaction('move')，context 带 seat/location/from）；强制描述子用 limit:'oncePerTurn'
//     表达「每回合第一次」（limits.js 记账）。
//   · 受到 1 点伤害：api.damage（普通伤害，可分配给支援）。

import { ownSeat } from '../../engine/matcher.js'

const code = '12104'

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入你的威胁区域；可用两个行动弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      kind: 'forced',
      trigger: 'move',
      limit: 'oncePerTurn',
      label: '你每回合第一次移动：受到 1 点伤害',
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.damage(inv.seat, 1),
    },
  ],
  modifiers: [],
}
