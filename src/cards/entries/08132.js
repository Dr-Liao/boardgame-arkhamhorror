// 08132 惊慌
// 本卡可如同调查员身上的 1 点恐惧被治愈；锁定只针对指定类型的行动。
const code = '08132'
const KINDS = ['play', 'resource', 'engage']

export default {
  code,
  threatHorrorSink: true,
  redirectHeal: { optional: true },
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域（1 点恐惧计数器）',
      weakness: { type: 'threat', horror: 1 },
    },
    {
      kind: 'forced',
      trigger: 'actionTaken',
      label: '执行打出、资源或交战行动后：本回合不能再执行这些行动',
      limit: { scope: 'perTurn', owner: 'player' },
      criteria: ({ inv, context }) => context?.seat === inv.seat
        && context.actionKinds?.some(kind => KINDS.includes(kind)),
      resolve: ({ inv, api }) => {
        api.prohibitActionsThisTurn(inv.seat, KINDS)
        api.info(`「惊慌」：${inv.name} 本回合不能再执行打出、资源或交战行动。`)
      },
    },
  ],
  modifiers: [],
}
