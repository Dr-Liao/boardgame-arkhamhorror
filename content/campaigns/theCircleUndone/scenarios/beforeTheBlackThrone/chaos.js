// 《黑色王座》· 混乱标记表（纯函数，供 behavior.resolveChaosToken / afterTest 引用）
//
// 参考实现 Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone.hs：
//   skull      -X，X = max(2, ceil(阿撒托斯上的毁灭 / 2))；困难 = max(2, 毁灭)
//   cultist    无修正；再揭示 1 个标记；失败时查找遭遇牌库/弃牌堆的一张异教徒敌人并抽取
//   tablet     -2 / -3；失败时阿撒托斯攻击你（behavior.afterTest 结算 3 伤害 3 恐惧）
//   elderthing -4 / -6；本次检定修正技能值为 0 时在阿撒托斯上放 1 毁灭（behavior 结算）
// 本文件只产出数值与追加效果描述；状态变更由 behavior 走唯一入口。

export const hardSide = state => ['hard', 'expert'].includes(state?.difficulty)

// 05328 背面：第三次议程推进后「场上所有毁灭标记视为在阿撒托斯上」。
// behavior.agendaRevealFor 在 discardSelf 时置 flags.azathothAbsorbsAllDoom；
// 此后的阿撒托斯毁灭 = 累积计数 + 场上所有卡牌/当前密谋上的毁灭（参考 Azathoth.hs:28-31 的 CountAllDoomInPlay）。
export const azathothDoomOf = state => {
  const flags = state?.scenarioFlags || {}
  const base = Number(flags.azathothDoom || 0)
  if (!flags.azathothAbsorbsAllDoom) return base
  const cards = [
    ...(state.locations || []),
    ...(state.enemies || []),
    ...(state.storyAssets || []),
    ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])]),
  ]
  const onCards = cards.reduce((sum, card) => sum + (Number(card.doom) || 0), 0)
  return base + onCards + Number(state.doom || 0)
}

// [skull]：X = max(2, ceil(毁灭/2))（简单/普通）；困难 = max(2, 毁灭)。
export function skullX(state) {
  const doom = azathothDoomOf(state)
  return hardSide(state) ? Math.max(2, doom) : Math.max(2, Math.ceil(doom / 2))
}

export function bbtChaosToken(state, inv, token) {
  if (token === 'skull') return { delta: -skullX(state), skullX: skullX(state) }
  if (token === 'cultist') {
    // 卡面：再揭示 1 个标记；如果检定失败，查找遭遇牌库/弃牌堆的一张异教徒敌人并抽取。
    return { delta: 0, drawAnother: true, onFail: [{ type: 'drawEnemyTrait', amount: 'Cultist' }] }
  }
  if (token === 'tablet') return { delta: hardSide(state) ? -3 : -2 }
  if (token === 'elderthing') return { delta: hardSide(state) ? -6 : -4, azathothIfZeroSkill: true }
  return null
}

export const BBT_CHAOS_TOKENS = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
