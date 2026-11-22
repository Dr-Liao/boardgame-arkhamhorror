// 12103 组织重担（Syndicate Obligations）· 中立 · 诡计/契约/辛迪加 · 基础弱点。
//
// 卡面：
//   显现 - 将组织重担放置入场，位于你的威胁区域。
//   强制 - 你花费资源后：受到 1 点伤害。
//   [action][action]：弃掉组织重担。
//
// 引擎读点：
//   · 显现 + 摆脱行动：weakness 描述子的 `{ type: 'threat', discardCost: { action: 2 } }`
//     （同 12102：moves.js/actions-extra.js 统一结算）。
//   · 「你花费资源后」：resourcesSpent 窗口（resource-bank.spendFromPool 扣款成功后派发；
//     任何资源支付来源——卡牌费用/能力费用/事件效果——都走同一出口）。
const code = '12103'

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入你的威胁区域；可用两个行动弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      // 读点：resourcesSpent 窗口（spendFromPool 扣款成功后派发）。
      kind: 'forced',
      trigger: 'resourcesSpent',
      label: '你花费资源后：受到 1 点伤害',
      criteria: [({ inv, context }) => Number(context?.seat) === inv.seat && Number(context?.amount) >= 1],
      resolve: ({ inv, api }) => api.damage(inv.seat, 1),
    },
  ],
  modifiers: [],
}
