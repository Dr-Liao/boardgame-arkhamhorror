// 《无归之地》· 混乱标记表与检定后后果。
//
// 事实源：PointOfNoReturn.hs 的 `HasChaosTokenValue` / `ResolveChaosToken` / `FailedSkillTest` /
// `PassedSkillTest`（SC/PONR:47-184），以及 en locale `pointOfNoReturn.json` 的 `tokens`。
//   skull      ：-X（X = 剧本参考卡上的伤害数 / Distortion；困难 -X-1）
//   cultist    ：无修正；揭示另一枚；失败 → 检定结束后抽 1 张遭遇牌
//   tablet     ：标准 +1 / 困难 0；调查检定成功 → 抽 1 张牌
//   elderthing ：标准 -3 / 困难 -4；失败差值 ≥2 → 选择同/相邻地点的 1 个已就绪敌人，
//                移动到你的地点、与你交战并立即攻击
//
// 读点：behavior.resolveChaosToken（引擎 treachery-tokens.js:318）与 behavior.afterTest。
// `afterTest` 可能被调用两次（自动失败 + 正常路径），用 result 上的幂等标记防止重复结算。

export const REFERENCE_MARKER_ID = 'reference'

export function referenceDamage(state) {
  const counts = state?.markerCounts
  const value = Number(counts?.[REFERENCE_MARKER_ID] || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function hardSide(state) {
  return state?.difficulty === 'hard' || state?.difficulty === 'expert'
}

export function markerCountOf(state, id = REFERENCE_MARKER_ID) {
  const value = Number(state?.markerCounts?.[id] || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** 数值：`{ delta, drawAnother?, onDraw?, onFail? }`（引擎 resolveSpecialToken 的返回口径）。 */
export function resolveChaosToken(state, inv, token) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const x = referenceDamage(state)
    return { delta: hard ? -(x + 1) : -x, drawAnother: false }
  }
  if (token === 'cultist') {
    return { delta: 0, drawAnother: true }
  }
  if (token === 'tablet') {
    return { delta: hard ? 0 : 1, drawAnother: false }
  }
  if (token === 'elderthing') {
    return { delta: hard ? -4 : -3, drawAnother: false }
  }
  return null
}

const activeInvestigators = state => (state?.investigators || [])
  .filter(inv => !inv.defeated && !inv.resigned)

function readyEnemiesNear(state, inv) {
  const location = (state.locations || []).find(entry => entry.id === inv.location)
  const connected = new Set(location?.connections || [])
  return (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.exhausted
    && (enemy.location === inv.location || connected.has(enemy.location)))
}

function isInvestigationResult(result) {
  const source = result?.source || {}
  const label = String(source.label || '')
  return label.includes('调查') || label === 'investigate' || source.action === 'investigate'
}

/** 检定后：cultist（失败抽遭遇）/ tablet（调查成功抽牌）/ elderthing（失败≥2 敌人攻击）。 */
export function chaosAfterTest(state, inv, result, api) {
  if (!inv || !result) return false
  if (result.pnrChaosHandled) return false
  const drawn = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
  if (!drawn.length) return false
  result.pnrChaosHandled = true
  const has = token => drawn.includes(token)
  let handled = false
  if (has('cultist') && !result.success) {
    api.drawEncounter?.(inv.seat)
    api.info?.(`🟣 邪教徒：${inv.name} 检定失败，抽 1 张遭遇牌。`)
    handled = true
  }
  if (has('tablet') && result.success && isInvestigationResult(result)) {
    api.drawCards?.(inv.seat, 1)
    api.info?.(`🟤 石板：${inv.name} 调查成功，抽 1 张牌。`)
    handled = true
  }
  if (has('elderthing') && !result.success) {
    const failedBy = Math.max(0, Number(result.difficulty ?? 0) - Number(result.value ?? 0))
    if (failedBy >= 2) {
      const candidates = readyEnemiesNear(state, inv)
      if (candidates.length) {
        const options = candidates.map((enemy, index) => ({
          id: String(index),
          label: `${enemy.name || enemy.code}（${enemy.location === inv.location ? '所在地点' : '相邻地点'}）`,
        }))
        const picked = candidates.length === 1
          ? 0
          : Number(api.choose?.({
            kind: 'enemy', source: '06247-elderthing', seat: inv.seat,
            prompt: '🟢 古神：选择一个已就绪的敌人（所在地点或相邻地点）。', options,
          }) ?? 0)
        const enemy = candidates[picked] || candidates[0]
        api.moveEnemy?.(enemy, inv.location)
        api.engage?.(enemy, inv.seat)
        api.attack?.(enemy, state.investigators?.[inv.seat])
        api.info?.(`🟢 古神：${enemy.name || enemy.code} 移动到「${inv.name}」所在地点并与其交战（立即攻击）。`)
        handled = true
      }
    }
  }
  return handled
}

export { activeInvestigators }
