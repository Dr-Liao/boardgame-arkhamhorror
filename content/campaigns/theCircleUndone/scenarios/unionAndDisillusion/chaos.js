// 05238《聚合幻灭》混乱标记表。
//
// 参考实现 `HasChaosTokenValue UnionAndDisillusion`（Scenario/Scenarios/TheCircleUndone/UnionAndDisillusion.hs:60-66）
// 与卡面 tokens（zh locale）：
//   skull      -2（困难/专家 -3）；如果该检定是阵法行动，再抽一个标记
//   cultist    -3（困难/专家 -4）；如果你的身上没有伤害标记受到 1 点伤害、没有恐惧标记受到 1 点恐惧
//   tablet     -3（困难/专家 -4）；失败 → 所在地点的一个幽灵敌人攻击你（不论是否横置）
//   elderthing -3（困难/专家 -4）；阵法检定失败 → 结算所在地点的所有闹鬼能力
// 失败后的额外效果在 behavior.afterTest 里结算（resolveChaosToken 只消费 delta 等字段）。

export const CIRCLE_SUMMONER = 'circle'

// 本次检定是否是「阵法」行动（P2.5：performTest 把 options.actionKind 记在 state.skillTest）。
export function isCircleTest(state) {
  return state?.skillTest?.actionKind === CIRCLE_SUMMONER
}

export function uadChaosToken(state, inv, token, api) {
  const hard = ['hard', 'expert'].includes(state.difficulty)
  if (token === 'skull') {
    const result = { delta: hard ? -3 : -2 }
    if (isCircleTest(state)) result.drawAnother = true
    return result
  }
  if (token === 'cultist') {
    return { delta: hard ? -4 : -3 }
  }
  if (token === 'tablet') return { delta: hard ? -4 : -3 }
  if (token === 'elderthing') return { delta: hard ? -4 : -3 }
  return null
}

// cultist 的「揭示时」效果：缺伤害/恐惧就各受 1 点（不受检定成败影响）。
export function uadCultistReveal(state, inv, api) {
  if (!inv) return
  const damage = Number(inv.damage) || 0
  const horror = Number(inv.horror) || 0
  if (damage === 0) api?.damage?.(inv.seat, 1)
  if (horror === 0) api?.horror?.(inv.seat, 1)
  if (damage === 0 || horror === 0) {
    api?.info?.(`异教徒标记：${inv.name} 在缺失的方向上受到 1 点伤害/恐惧。`)
  }
}

export default uadChaosToken
