// 《恶罪报应》的混乱标记表（05161 卡面 + zh locale tokens）。
//
// 参考实现：`TheWagesOfSin.hs` 的 `HasChaosTokenValue` / `ResolveChaosToken` / `FailedSkillTest`：
//   skull     ：-X（X = 胜利区「未了之事」张数 + 1；困难面为张数且再抽一个标记）
//   cultist   ：-3 / -4；直到一轮结束，场上每个异端者敌人 +1 攻击/+1 躲避
//   tablet    ：-3 / -4；如果你失败，触发威胁区一张未了之事的强制能力（如同轮末）
//   elderthing：-2；失败且本次为攻击/躲避（困难面不要求失败）→ 结算所在地点全部闹鬼能力
import { chaosFx, hardSide, here } from '../../tcu-chaos.js'
import { UNFINISHED_BUSINESS_CODES } from './definition.js'

const SKILL_ACTION_LABELS = ['攻击', '躲避']

export function isAttackOrEvadeTest(result) {
  return SKILL_ACTION_LABELS.includes(String(result?.source?.label || ''))
}

export function unfinishedBusinessInVictory(state) {
  return (state.victoryDisplay || []).filter(card =>
    UNFINISHED_BUSINESS_CODES.includes(card.code || card.originalCode)).length
}

export function resolveChaosToken(state, inv, token, api = {}) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const count = unfinishedBusinessInVictory(state)
    const value = hard ? count : count + 1
    return chaosFx(-value, hard ? { drawAnother: true } : {})
  }
  if (token === 'cultist') {
    // 本轮结束前场上每个异端者敌人 +1 攻击/+1 躲避：只记本轮标记。
    // behavior.enemyStatModifier 按「本轮标记 + isHereticEnemy」读取，因此本轮后生成或
    // 由未了之事翻回敌人面的异端者也在覆盖范围内。
    state.scenarioFlags ||= {}
    state.scenarioFlags.wosCultistBuffRound = state.round
    return chaosFx(hard ? -4 : -3)
  }
  if (token === 'tablet') return chaosFx(hard ? -4 : -3)
  if (token === 'elderthing') return chaosFx(-2)
  return null
}

// 检定后：tablet（失败 → 触发未了之事强制）与 elderthing（攻击/躲避后结算闹鬼）。
// `handlers.triggerUnfinishedBusinessForced(inv, threat)` 由 behavior.afterTest 注入
// （本模块不 import 章节目录，避免循环依赖）。
// 一次揭示可能同时有 tablet 与 elderthing（困难面 skull「再揭示一个标记」可能凑出），两个都要结算。
export function chaosAfterTest(state, inv, result, api = {}, handlers = {}) {
  const tokens = (result?.drawn || []).filter(token => !(result?.cancelledTokens || []).includes(token))
  const has = token => tokens.includes(token)
  const hard = hardSide(state)
  const location = here(state, inv)
  let handled = false
  if (has('tablet') && !result.success) {
    const stories = (inv.threat || []).filter(card =>
      UNFINISHED_BUSINESS_CODES.includes(card.code || card.originalCode))
    if (stories.length) {
      const story = stories.length === 1 ? stories[0]
        : (() => {
          const answer = api.choose?.({
            kind: 'option', source: '05161', seat: inv.seat,
            prompt: '石板标记：选择一张未了之事，触发它的强制能力（如同轮末）。',
            options: stories.map((card, index) => ({ id: String(index), label: card.name || card.code })),
          })
          return stories.find((card, index) => String(index) === String(answer)) || stories[0]
        })()
      api.info?.(`🪨 石板标记：如同轮末一般触发「${story.name || story.code}」的强制能力。`)
      const trigger = handlers.triggerUnfinishedBusinessForced || api.triggerUnfinishedBusinessForced
      if (typeof trigger === 'function') trigger(inv, story)
      handled = true
    }
  }
  if (has('elderthing') && (hard || !result.success) && isAttackOrEvadeTest(result)) {
    api.haunted?.(inv.seat, { locationId: location?.id || inv.location, kind: 'elderthing' })
    handled = true
  }
  return handled
}
