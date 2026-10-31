// 06196 安全护卫
// 卡面：[reaction] 在其他调查员的回合期间，横置安全护卫：在该调查员的回合结束前，
//       当该调查员从你所在地点移动到连接地点时，你也可以移动到该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：移动后的 `move` 窗口（src/engine/movement.js 的 triggerReaction('move')，
// 上下文带 { seat: 移动者, location: 目标地点 }）。窗口对所有存活调查员开放，
// 因此「其他调查员移动」由 criteria 过滤；移动者是否在自己的回合由 phase/currentSeat 判定。
// 已知简化：「从你所在地点出发」无法验证——窗口上下文没有来源地点（见 simplified note）。

export default {
  code: '06196',
  simplified: true,
  note: '未实现：「从你所在地点移动到连接地点」的出发地判定——move 窗口上下文只带目标地点，没有移动前所在地点（需要移动窗口补充来源地点的新原语，P10 前处理）；改为判定「目标地点与安全护卫持有者所在地点相连」。跟随移动本身已实现。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'move',
      label: '其他调查员移动到连接地点时：横置安全护卫并跟随移动',
      cost: { exhaust: true },
      criteria: [({ state, inv, context }) => {
        if (!context || context.seat == null || context.location == null) return false
        if (context.seat === inv.seat) return false
        // 「在其他调查员的回合期间」：移动发生在调查阶段且当前行动者是该调查员。
        if (state.phase !== 'investigation' || state.currentSeat !== context.seat) return false
        if (context.location === inv.location) return false
        const here = state.locations.find(location => location.id === inv.location)
        const there = state.locations.find(location => location.id === context.location)
        if (!here || !there) return false
        return (here.connections || []).includes(context.location)
          || (there.connections || []).includes(inv.location)
      }],
      resolve: ({ inv, api, context }) => {
        api.moveInvestigator(inv.seat, context.location)
        api.info(`${inv.name} 使用「安全护卫」跟随着移动到「${api.locationName(context.location)}」。`)
      },
    },
  ],
  modifiers: [],
}
