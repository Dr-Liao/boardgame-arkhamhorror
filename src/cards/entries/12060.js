// 12060 吉姆·卡尔弗（Jim Culver）
// 卡面：你得到+1[willpower]。
//       [reaction] 你受到伤害和/或恐惧后，横置吉姆·卡尔弗：抽取 1 张卡牌。
//
// 读点：
//   · +1 意志 → 卡面修正 modifiers（statPipeline 统一叠加）；
//   · 「受到伤害和/或恐惧后」→ harmDealt 窗口（上下文 seat/damage/horror，11054/08116 同一读点）；
//   · 横置代价 → cost.exhaust；抽牌 → api.drawCards。
const CODE = '12060'

export default {
  code: CODE,
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      cost: { exhaust: true },
      label: '受到伤害/恐惧后横置：抽 1 张牌',
      criteria: [
        ({ inv, context }) => context?.seat === inv.seat
          && ((Number(context?.damage) || 0) > 0 || (Number(context?.horror) || 0) > 0),
      ],
      resolve: ({ inv, api }) => {
        api.drawCards(inv.seat, 1)
        api.info(`🎺「吉姆·卡尔弗」：${inv.name} 受到伤害/恐惧后抽 1 张牌。`)
      },
    },
  ],
}
