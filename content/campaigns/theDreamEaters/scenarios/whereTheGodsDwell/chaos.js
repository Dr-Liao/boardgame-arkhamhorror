// 神居之所（Where the Gods Dwell · 06286）· 混乱标记取值与失败后果。
//
// 参考实现：WhereTheGodsDwell.hs 的 HasChaosTokenValue / ResolveChaosToken / FailedSkillTest，
// 以及 P8-CAMPAIGN-FACTS §3.3 WTGD 行（SC/WTGD:44-50,140-162）：
//   [skull]  简单/普通 -X（X = 当前幕编号）；困难/专家 -(幕编号 + 密谋编号)
//   [cultist] 0；再揭示一个标记。失败：在当前密谋上放 1 毁灭（困难/专家：可导致推进）
//   [tablet]  -4 / -6；失败：选择并揭示你手中的一张奈亚拉托提普，其攻击你并洗回遭遇牌库
//   [elder_thing] 0 / -1（黑猫提醒你这一切都是一场梦）
//
// `behavior.resolveChaosToken` 只算数值；失败后果放在 `behavior.afterTest`（引擎会分别在自动失败与
// 正常路径各调一次，本文件按 result 幂等）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'

const original = card => card?.originalCode || card?.code || card
const activeInvestigators = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
export const hardSide = state => ['hard', 'expert'].includes(state?.difficulty)

export const actStep = state => Math.max(1, Number(state?.actIndex ?? 0) + 1)
export const agendaStep = state => Math.max(1, Number(state?.agendaIndex ?? 0) + 1)

const isNyarlathotepCopy = code => entryFlags(original(code))?.nyarlathotepCopy === true

// token 数值：返回引擎 resolveChaosToken 的 { delta, drawAnother, onDraw, onFail } 形状。
export function whereTheGodsDwellChaosToken(state, inv, token) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const value = -(actStep(state) + (hard ? agendaStep(state) : 0))
    return { delta: value }
  }
  if (token === 'cultist') {
    // 「再揭示一个标记」：引擎的 drawAnother 通道。
    return { delta: 0, drawAnother: true }
  }
  if (token === 'tablet') return { delta: hard ? -6 : -4 }
  if (token === 'elder_thing') return { delta: hard ? -1 : 0 }
  return null
}

// 「手中隐藏的奈亚拉托提普攻击并把自身洗回遭遇牌库」（tablet 失败；也用于议程/行动背面，
// 由 behavior 的共用 helper 调用）。
export function revealAndAttackHandCopies(state, api, seat, { times = 1 } = {}) {
  const copies = (api?.hiddenCards?.list?.(seat) || []).filter(isNyarlathotepCopy)
  if (!copies.length) return 0
  const inv = state.investigators[seat]
  if (!inv) return 0
  for (const code of copies) {
    api?.cardReveal?.(code, '揭示手牌中的奈亚拉托提普')
    const card = ALL_CARDS[code] || {}
    for (let index = 0; index < times; index += 1) {
      if (Number(card.damage) > 0) api?.damage?.(seat, Number(card.damage))
      if (Number(card.horror) > 0) api?.horror?.(seat, Number(card.horror))
    }
    // 洗回遭遇牌库：先离开手牌（hiddenCards.take 同步清标记），再洗入。
    if (api?.hiddenCards?.take?.(seat, code)) api?.shuffleIntoEncounterDeck?.([code])
  }
  return copies.length
}

// 技能检定后的标记后果（参考 FailedSkillTest 分支；幂等：afterTest 可能被调两次）。
export function whereTheGodsDwellChaosAfterTest(state, inv, result, api) {
  if (!result || !inv || result.wgdChaosHandled) return
  result.wgdChaosHandled = true
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const has = token => tokens.includes(token)
  const failed = result.success === false

  // [cultist] 失败：在当前密谋上放置 1 个毁灭。
  // 简单/普通：只放（不会自动检查推进）；困难/专家：放完可导致当前密谋推进。
  if (failed && has('cultist')) {
    const agenda = state.agendas?.[state.agendaIndex] || null
    if (hardSide(state)) {
      api?.addDoom?.(1)
      api?.info?.(`[cultist]：在当前密谋上放置 1 个毁灭（困难/专家：本效果可能导致密谋推进）。`)
    } else if (agenda) {
      api?.doomOn?.(agenda, 1)
      api?.info?.(`[cultist]：在当前密谋上放置 1 个毁灭。`)
    }
  }

  // [tablet] 失败：选择并揭示手中一张奈亚拉托提普；它攻击你并被洗回遭遇牌库。
  if (failed && has('tablet')) {
    const copies = (api?.hiddenCards?.list?.(inv.seat) || []).filter(isNyarlathotepCopy)
    if (copies.length) {
      const chosen = copies.length === 1 ? copies[0] : String(api?.choose?.({
        kind: 'card', source: 'chaos-tablet', seat: inv.seat,
        prompt: '[tablet]：选择并揭示你手中的一张奈亚拉托提普。',
        options: copies.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })),
      }))
      const code = copies.includes(chosen) ? chosen : copies[Number(chosen)] || copies[0]
      api?.cardReveal?.(code, '[tablet] 揭示手牌中的奈亚拉托提普')
      const card = ALL_CARDS[code] || {}
      if (Number(card.damage) > 0) api?.damage?.(inv.seat, Number(card.damage))
      if (Number(card.horror) > 0) api?.horror?.(inv.seat, Number(card.horror))
      if (api?.hiddenCards?.take?.(inv.seat, code)) api?.shuffleIntoEncounterDeck?.([code])
      api?.info?.(`[tablet]：手中的奈亚拉托提普攻击了 ${inv.name}，随后被洗回遭遇牌库。`)
    }
  }
}

// 冷原（06296）的「调查时揭示特殊标记 → 受伤或失去行动」在 behavior.afterTest 里读
// 地点条目的 locationRule.tokenPenalty（见 behavior 的 coldWastesTokenPenalty）。

