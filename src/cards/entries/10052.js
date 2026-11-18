// 10052 加布里埃尔·卡里洛（Gabriel Carillo）· 探求者支援 · 1 经验 · 费用 4 · 盟友槽 · 盟友/学者/诅咒。
//
// 卡面：你得到 +1[智力]。
//       [reaction] 当你回合开始时，在混乱袋中加入 1 个[curse]标记：抽取 1 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · +1[智力] → 条目 `modifiers` 的 `skill:intellect`（statPipeline 统一叠加）。
//   · 「当你回合开始时」→ `turnBegins` 窗口（turn.js#turnBeginningWindow，context 带 seat/location）；
//     criteria 只认本轮自己的座位，避免别人的回合开始也询问。
//   · 「在混乱袋中加入 1 个[curse]标记」是费用（冒号前）→ 描述子 `additionalTokenCost`
//     （token-cost.js 的唯一校验/支付读点；ability-rules.js 的 canAffordAbility / payAbilityCost
//     在候选枚举与结算时共用，袋满 10 个诅咒时这条反应不出现）。
//   · 抽 1 张 → api.drawCards（deck-ops.js#drawCards，抽到弱点照常结算）。
export default {
  code: '10052',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      // 同一「回合开始」事件只结算一次：引擎对 turnBegins 会先后走 triggerReaction 与
      // reactionWindow 两条派发路径（与 10012 同一去重口径），perWindow 保证不重复询问。
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '回合开始：在混乱袋加入 1 个[curse]标记；抽 1 张牌',
      additionalTokenCost: { token: 'curse', operation: 'add', count: 1 },
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ inv, api }) => {
        api.drawCards(inv.seat, 1)
        api.info(`🧑‍🏫 「加布里埃尔·卡里洛」：${inv.name} 在混乱袋加入 1 个诅咒标记并抽 1 张牌。`)
      },
    },
  ],
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
}
