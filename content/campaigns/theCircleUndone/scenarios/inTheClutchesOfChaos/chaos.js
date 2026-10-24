// 《混沌魔掌》· 混乱标记表（纯函数，供 behavior.resolveChaosToken / afterTest 引用）
//
// 参考实现 Scenario/Scenarios/TheCircleUndone/InTheClutchesOfChaos.hs：
//   skull      -X，X = 你所在地点的裂口 + 毁灭（困难 +1）
//   cultist    无修正；再揭示 1 个标记；所在地点裂口 < 3 则放 1 裂口（副作用由 behavior 结算）
//   tablet     -2 / -3；失败且每低于难度 1 点移除当前幕 1 个裂口（afterTest）
//   elderthing -3 / -4；失败则在随机地点放 1 裂口（afterTest）
// 本文件只产出「数值 + 追加效果描述」，所有状态变更由 behavior 走唯一入口。

export const CN = Object.freeze({
  skull: '骷髅', cultist: '异教徒', tablet: '石板', elderthing: '古神', autofail: '自动失败', eldersign: '长老印记',
})

export const hardSide = state => ['hard', 'expert'].includes(state?.difficulty)

const locationById = (state, id) => (state?.locations || []).find(location => location.id === id) || null

export function breachesOf(location) {
  const value = Number(location?.breaches || 0)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

// [skull]：-（裂口 + 毁灭）〔困难再 -1〕
export function skullX(state, inv) {
  const location = locationById(state, inv?.location)
  const total = breachesOf(location) + Number(location?.doom || 0)
  return total + (hardSide(state) ? 1 : 0)
}

// 混乱标记取值：只返回引擎消费的字段（delta / drawAnother），副作用另行记账。
export function clutchesChaosToken(state, inv, token) {
  if (token === 'skull') return { delta: -skullX(state, inv), skullX: skullX(state, inv) }
  if (token === 'cultist') {
    const location = locationById(state, inv?.location)
    const breaches = breachesOf(location)
    return {
      delta: 0,
      drawAnother: true,
      // 卡面：如果你所在地点的裂口少于 3 个，在其上放置 1 个裂口（behavior 结算）。
      placeBreachAt: breaches < 3 && location ? location.id : null,
    }
  }
  if (token === 'tablet') return { delta: hardSide(state) ? -3 : -2 }
  if (token === 'elderthing') return { delta: hardSide(state) ? -4 : -3 }
  return null
}

// 失败后的追加效果（由 behavior.afterTest 应用到状态）：
//   tablet      失败且每低于难度 1 点 → 移除当前幕 1 个裂口
//   elderthing  失败 → 随机 1 个地点放 1 裂口
export function clutchesAfterTestEffects(state, inv, result) {
  const tokens = (result?.drawn || []).filter(token => !(result?.cancelledTokens || []).includes(token))
  const effects = []
  if (!tokens.length) return effects
  const failed = result?.success === false
  const failedBy = failed ? Math.max(0, Number(result?.difficulty || 0) - Number(result?.value || 0)) : 0
  if (tokens.includes('tablet') && failedBy > 0) {
    effects.push({ type: 'removeActBreaches', amount: failedBy, token: 'tablet' })
  }
  if (tokens.includes('elderthing') && failed) {
    effects.push({ type: 'placeBreachRandom', amount: 1, token: 'elderthing' })
  }
  return effects
}

export const CLUTCHES_CHAOS_TOKENS = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
