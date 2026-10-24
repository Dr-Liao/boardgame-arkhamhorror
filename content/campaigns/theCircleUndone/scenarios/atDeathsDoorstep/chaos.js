// 《死亡门前》的混乱标记表（05065 卡面 + zh locale tokens）。
//
// 参考实现：`AtDeathsDoorstep.hs` 的 `HasChaosTokenValue` 与 `FailedSkillTest`/`ResolveChaosToken`：
//   skull     ：地点闹鬼 → 简单 -3 / 困难 -4；否则 -1 / -2
//   tablet    ：-2 / -3；失败且本次为攻击/躲避（困难面不要求失败）→ 结算所在地点全部闹鬼能力
//   elderthing：-2 / -4；所在地点有幽灵敌人 → 受 1 点伤害（困难面再加 1 点恐惧）
// 其余标记交回引擎默认表。
import { chaosFx, hardSide, here, spectralEnemies } from '../../tcu-chaos.js'

const SKILL_ACTION_LABELS = ['攻击', '躲避']

// 本次技能检定是否为「攻击或躲避尝试」：引擎的攻击/躲避检定 source.label 固定为这两个词。
export function isAttackOrEvadeTest(result) {
  return SKILL_ACTION_LABELS.includes(String(result?.source?.label || ''))
}

export function resolveChaosToken(state, inv, token, api = {}) {
  const hard = hardSide(state)
  const location = here(state, inv)
  if (token === 'skull') {
    const haunted = Boolean(api.hauntedIs?.(location?.id))
      || Boolean((location?.haunted || []).length)
    if (haunted) return chaosFx(hard ? -4 : -3)
    return chaosFx(hard ? -2 : -1)
  }
  if (token === 'tablet') return chaosFx(hard ? -3 : -2)
  if (token === 'elderthing') {
    const spectral = location
      ? spectralEnemies(state).some(enemy => enemy.location === location.id)
      : false
    if (spectral) {
      api.damage?.(inv.seat, 1)
      if (hard) api.horror?.(inv.seat, 1)
      api.info?.(`👻 古神标记：${inv.name} 所在地点有幽灵敌人，受到 1 点伤害${hard ? '与 1 点恐惧' : ''}。`)
    }
    return chaosFx(hard ? -4 : -2)
  }
  return null
}

// 检定后：tablet 的「结算所在地点全部闹鬼能力」。
// 简单/普通：失败且本次为攻击/躲避；困难/专家：只要本次是攻击/躲避（卡面勘误：不要求失败）。
export function chaosAfterTest(state, inv, result, api = {}) {
  const tokens = (result?.drawn || []).filter(token => !(result?.cancelledTokens || []).includes(token))
  if (!tokens.includes('tablet')) return false
  if (!isAttackOrEvadeTest(result)) return false
  const hard = hardSide(state)
  if (!hard && result.success) return false
  api.haunted?.(inv.seat, { locationId: inv.location, kind: 'tablet' })
  return true
}
