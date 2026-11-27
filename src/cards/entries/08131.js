// 08131 腿伤
// 本卡可如同调查员身上的 1 点伤害被治愈；锁定只针对指定类型的行动。
const code = '08131'
const KINDS = ['move', 'resign', 'evade']

export default {
  code,
  flags: { threatDamageSink: true },
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域（1 点伤害计数器）',
      weakness: { type: 'threat', clues: 1 },
    },
    {
      kind: 'forced',
      trigger: 'actionTaken',
      label: '执行移动、撤退或躲避行动后：本回合不能再执行这些行动',
      limit: { scope: 'perTurn', owner: 'player' },
      criteria: ({ inv, context }) => context?.seat === inv.seat
        && context.actionKinds?.some(kind => KINDS.includes(kind)),
      resolve: ({ inv, api }) => {
        api.prohibitActionsThisTurn(inv.seat, KINDS)
        api.info(`「腿伤」：${inv.name} 本回合不能再执行移动、撤退或躲避行动。`)
      },
    },
  ],
  modifiers: [],
}
