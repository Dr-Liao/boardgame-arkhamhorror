// 09071 时髦大衣（Stylish Coat）· 游荡者（Rogue）资产 · 1 经验 · 道具 · 服装 · 身体。
//
// 卡面：[reaction] 你在自己回合期间通过另一张玩家卡牌的效果获得 1 点或更多资源时，横置时髦大衣：
//       获得额外 1 资源。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：费用/触发时机由 cost.exhaust 与能力窗口给出，额外资源走 api.gainResources（统一资源入口）。
export default {
  code: '09071',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'resourcesGained',
      cost: { exhaust: true },
      label: '你在自己回合通过另一张玩家卡牌效果获得资源后：横置，获得额外 1 资源',
      criteria: [({ state, inv, source, context }) => state.phase === 'investigation'
        && state.currentSeat === inv.seat && context.seat === inv.seat && context.amount > 0
        && context.source?.kind === 'playerCard' && context.source.sourceId !== source?.id],
      resolve: ({ inv, api }) => {
        api.gainResources(inv.seat, 1)
        api.info(`🧥 「时髦大衣」：${inv.name} 获得额外 1 资源。`)
      },
    },
  ],
  modifiers: [],
}
