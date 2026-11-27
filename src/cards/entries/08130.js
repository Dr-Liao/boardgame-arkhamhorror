// 08130 臂伤
// 本卡可如同调查员身上的 1 点伤害被治愈；锁定只针对指定类型的行动。
const code = '08130'
const KINDS = ['fight', 'activate']

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
      label: '执行攻击或启动行动后：本回合不能再执行这些行动',
      limit: { scope: 'perTurn', owner: 'player' },
      criteria: ({ inv, context }) => context?.seat === inv.seat
        && context.actionKinds?.some(kind => KINDS.includes(kind)),
      resolve: ({ inv, api }) => {
        api.prohibitActionsThisTurn(inv.seat, KINDS)
        api.info(`「臂伤」：${inv.name} 本回合不能再执行攻击或启动行动。`)
      },
    },
  ],
  modifiers: [],
}
