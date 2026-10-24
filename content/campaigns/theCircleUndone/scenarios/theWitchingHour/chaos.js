// 巫异时刻（05050）· 混乱标记的逐章取值与后果（参考 TheWitchingHour.hs:59-64, 273-301）。
//
// `behavior.resolveChaosToken` 只负责「标记数值」；失败后的弃牌/抽取/重整治愈按参考实现
// 放在 `afterTest`（引擎会分别在自动失败与正常路径各调一次，本文件按 result 幂等）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { chaosFx, hardSide } from '../../tcu-chaos.js'

const original = card => card?.originalCode || card?.code || card
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())
const isWitch = card => traitsOf(card).includes('witch')

// 卡面数值：简单/普通 skull -1、tablet -1、elderthing -3；困难/专家 -2 / -2 / -4。
export function witchingHourChaosToken(state, inv, token, api) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const value = chaosFx(hard ? -2 : -1)
    // 困难/专家：「从遭遇牌堆顶弃牌，弃掉的张数等于本次检定的难度」（揭示时立即结算）。
    if (hard) {
      const difficulty = Number(state.skillTest?.difficulty ?? api?.testDifficulty?.() ?? 0)
      discardEncounterTop(state, inv, difficulty, api)
    }
    return value
  }
  if (token === 'tablet') return chaosFx(hard ? -2 : -1)
  if (token === 'elderthing') return chaosFx(hard ? -4 : -3)
  return null
}

function discardEncounterTop(state, inv, amount, api) {
  let left = Math.max(0, Math.floor(Number(amount) || 0))
  const discarded = []
  while (left-- > 0 && Array.isArray(state.encounterDeck) && state.encounterDeck.length) {
    const code = state.encounterDeck.pop()
    state.encounterDiscard.push(code)
    discarded.push(code)
  }
  if (discarded.length) {
    api?.info?.(`「${inv?.name || '调查员'}」弃掉遭遇牌库顶 ${discarded.length} 张牌。`)
  }
  return discarded
}

// 技能检定后的后果（参考 FailedSkillTest 分支）。
export function witchingHourChaosAfterTest(state, inv, result, api) {
  if (!result || !inv) return
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const has = token => tokens.includes(token)
  const failed = !result.success
  const hard = hardSide(state)

  // [tablet] 失败：抽取遭遇弃牌堆最底部的一张诡计卡（简单/普通与困难/专家相同）。
  if (failed && has('tablet')) {
    const index = (state.encounterDiscard || []).findIndex(code => ALL_CARDS[code]?.type === 'treachery')
    if (index >= 0) {
      const [code] = state.encounterDiscard.splice(index, 1)
      state.encounterDeck.push(code)
      api?.info?.(`[tablet]：抽取遭遇弃牌堆最底部的「${ALL_CARDS[code]?.nameZh || code}」。`)
      api?.drawEncounter?.(inv.seat)
    } else {
      api?.info?.('[tablet]：遭遇弃牌堆里没有诡计卡，效果结束。')
    }
  }

  // [skull] 简单/普通失败：每低于难度 1 点，弃遭遇牌库顶 1 张。
  if (failed && !hard && has('skull')) {
    const failedBy = Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
    discardEncounterTop(state, inv, failedBy, api)
  }

  // [elderthing] 失败：选择（简单/普通）/全部（困难/专家）重整并治愈女巫敌人。
  if (failed && has('elderthing')) {
    const locationId = inv.location
    const candidates = (state.enemies || []).filter(enemy => isWitch(enemy)
      && (enemy.location === locationId
        || (state.locations.find(loc => loc.id === locationId)?.connections || []).includes(enemy.location)))
    if (!candidates.length) {
      api?.info?.('[elderthing]：所在地点与连接地点没有女巫敌人。')
      return
    }
    const targets = hard ? candidates : [candidates.length === 1 ? candidates[0] : candidates.find(enemy =>
      String(enemy.id) === String(api?.choose?.({
        kind: 'enemy', source: '05050-elderthing', seat: inv.seat,
        prompt: '选择要重整并治愈的女巫敌人。',
        options: candidates.map(enemy => ({ id: String(enemy.id), label: enemy.name })),
      }))) || candidates[0]]
    for (const enemy of targets.filter(Boolean)) {
      enemy.exhausted = false
      enemy.damageTaken = 0
      api?.info?.(`[elderthing]：重整并治愈「${enemy.name}」。`)
    }
  }
}

// tokenMeanings 兜底（自定义符号不会被引擎默认表吞掉）。
export const WITCHING_HOUR_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-1。你检定失败且每低于难度 1 点，弃掉遭遇牌库顶 1 张卡牌。', delta: -1 },
    tablet: { text: '-1。如果你检定失败，抽取遭遇弃牌堆最底部的 1 张诡计卡。', delta: -1 },
    elderthing: { text: '-3。如果你检定失败，选择并重整、治愈一个女巫敌人。', delta: -3 },
  },
  hard: {
    skull: { text: '-2。从遭遇牌库顶弃牌，弃掉的张数等于本次检定的难度。', delta: -2 },
    tablet: { text: '-2。如果你检定失败，抽取遭遇弃牌堆最底部的 1 张诡计卡。', delta: -2 },
    elderthing: { text: '-4。如果你检定失败，重整并治愈所有连接地点的女巫敌人。', delta: -4 },
  },
})
