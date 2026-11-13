// 09037 殉道者护臂（Martyr's Vambrace）· 守卫者资产（3 级）· 饰品槽 · 生命 2 / 神智 2。
// 卡面：你结算遭遇卡牌的显现能力时得到 +1 技能值。
//       [reaction] 你所在地点的其他调查员抽取非险境遭遇卡牌后，结算该卡牌的效果前，横置殉道者护臂：
//       改为视为你抽取了该遭遇卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 显现 +1：modifiers 用声明式条件 treacheryResolving（读点 modifiers.js#evaluateCondition），
//     显现能力结算期间的技能检定 +1；
//   · 改为你抽取：窗口 encounterDrawn（抽到遭遇后、结算前，上下文带 seat/cardCode/peril），
//     条件 = 其他同地点调查员抽到非险境卡；效果 api.redirectEncounterTo(inv.seat)（反应窗口里
//     唯一的接线点，会把这次遭遇改由你结算）。
const SOURCE = '09037'

export default {
  code: '09037',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'encounterDrawn',
      label: '横置：把同地点其他调查员抽到的非险境遭遇卡改为由你结算',
      cost: { exhaust: true },
      criteria: [({ state, inv, context }) => {
        if (!context || !Number.isInteger(context.seat)) return false
        if (context.seat === inv.seat || context.peril) return false
        return state.investigators[context.seat]?.location === inv.location
      }],
      resolve: ({ state, inv, context, api }) => {
        // 能力窗口里 state._reaction 可能为空（只有旧式反应才写它），因此显式把窗口上下文
        // 交给 setReactionFlag：redirectSeat 是 encounter.js 读取「改由谁结算」的唯一字段。
        api.setReactionFlag('redirectSeat', inv.seat, context)
        api.setReactionFlag('location', inv.location, context)
        api.info('殉道者护臂：这次遭遇改由你承受。')
      },
    },
  ],
  modifiers: [
    // 显现能力结算期间（treacheryResolving）所有技能检定 +1。
    { target: 'skill:*', amount: 1, condition: { treacheryResolving: true } },
  ],
}
