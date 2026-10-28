// 失去资源：玩家卡 api 与剧本遭遇 api 共用的唯一实现（05280 的 wouldLoseResources 窗口）。
// 从 api-misc.js 抽出（P2-6，2026-10-28），避免 04082 等遭遇卡再写一遍「扣资源」。
export function loseResources(state, inv, amount, { reactionWindow, events, info }) {
  if (!inv || !(amount > 0)) return 0
  const context = reactionWindow(state, 'wouldLoseResources', {
    when: 'wouldLoseResources', seat: inv.seat, amount, what: 'resources', location: inv.location,
    source: { kind: state._enemyAttackResolving ? 'enemyAttack' : state._treacheryResolving ? 'encounter' : 'other' },
    prompt: `${inv.name} 将要失去 ${amount} 资源`,
  }, events)
  if (context.cancelled) {
    info(state, events, `🛡️ ${inv.name} 忽略了失去资源的效果。`)
    return 0
  }
  const lost = Math.min(inv.resources, amount)
  inv.resources -= lost
  return lost
}
