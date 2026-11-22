// 60373 扫地出门（升级版，André Patel，1 XP）
// 卡面：扫地出门投入到技能检定后，执行检定的调查员获得 4 资源。如果本次技能检定失败，该调查员失去 4 资源。
const AMOUNT = 4

export default {
  code: '60373',
  abilities: [{
    kind: 'commit',
    label: `投入后获得 ${AMOUNT} 资源；检定失败则失去 ${AMOUNT} 资源`,
    skill: {
      onCommit: ({ inv, api }) => api.gainResources(inv.seat, AMOUNT),
      onFail: ({ inv, api }) => api.loseResources(inv.seat, AMOUNT),
    },
  }],
}
