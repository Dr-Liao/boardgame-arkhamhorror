// 隐秘之名（05120）· 混乱标记的逐章取值与后果（参考 TheSecretName.hs:50-62, 193-217）。
//
// 引擎只消费 resolveChaosToken 的 delta/autoFail/drawAnother/onDraw/onFail；
// 失败后的弃牌/Nahab 攻击/猎手移动按参考实现放在 afterTest（按 result 幂等）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { chaosFx, hardSide } from '../../tcu-chaos.js'

export const NAHAB_CODE = '05149'
const original = card => card?.originalCode || card?.code || card
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(trait)

function isExtradimensional(state, inv) {
  const location = (state.locations || []).find(entry => entry.id === inv?.location)
  if (!location) return false
  const traits = location.traits
    || ALL_CARDS[location.originalCode || location.code]?.traits
    || []
  return traits.some(trait => String(trait).toLowerCase() === 'extradimensional')
}

// 卡面数值：skull -1（异次元地点 -3）/ 困难 -2（-3）；tablet -2/-3；elderthing -3/-4；
// cultist 无修正但「再揭示一个混乱标记」。
export function secretNameChaosToken(state, inv, token, api) {
  const hard = hardSide(state)
  if (token === 'skull') return chaosFx(isExtradimensional(state, inv) ? (hard ? -3 : -3) : (hard ? -2 : -1))
  if (token === 'cultist') return chaosFx(0, { drawAnother: true })
  if (token === 'tablet') return chaosFx(hard ? -3 : -2)
  if (token === 'elderthing') return chaosFx(hard ? -4 : -3)
  return null
}

function discardEncounterTop(state, inv, amount, api) {
  const discarded = []
  for (let index = 0; index < Math.max(0, Math.floor(amount || 0)); index++) {
    if (!state.encounterDeck.length) break
    const code = state.encounterDeck.pop()
    state.encounterDiscard.push(code)
    discarded.push(code)
  }
  if (discarded.length) api?.info?.(`「${inv?.name || '调查员'}」弃掉遭遇牌库顶 ${discarded.length} 张牌。`)
  return discarded
}

function moveHunters(state, api) {
  for (const enemy of state.enemies || []) {
    if (!enemy.hunter) continue
    api?.hunterStep?.(enemy, {})
  }
}

export function secretNameChaosAfterTest(state, inv, result, api) {
  if (!result || !inv) return
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const has = token => tokens.includes(token)
  const failed = !result.success
  const hard = hardSide(state)

  if (failed && has('cultist')) discardEncounterTop(state, inv, hard ? 5 : 3, api)

  if (failed && has('tablet')) {
    const nahab = (state.enemies || []).find(enemy => String(original(enemy)) === NAHAB_CODE)
    if (nahab) {
      const atYourLocation = nahab.location === inv.location
      if (hard || atYourLocation) {
        api?.info?.(`[tablet]：那赫卜攻击 ${inv.name}。`)
        api?.attack?.(nahab, inv)
      }
    }
  }

  // [elderthing] 失败（简单/普通）或揭示（困难/专家）：结算场上每个敌人的猎手关键词。
  if (has('elderthing') && (hard || failed)) {
    api?.info?.('[elderthing]：结算场上每个敌人的猎手关键词。')
    moveHunters(state, api)
  }
}

export const SECRET_NAME_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-1（如果你位于异次元地点，改为 -3）。', delta: -1 },
    cultist: { text: '再揭示一个混乱标记。如果你检定失败，弃掉遭遇牌库顶 3 张卡牌。', delta: 0 },
    tablet: { text: '-2。如果你检定失败且那赫卜在你的地点，她攻击你。', delta: -2 },
    elderthing: { text: '-3。如果你检定失败，结算场上每个敌人的猎手关键词。', delta: -3 },
  },
  hard: {
    skull: { text: '-2（如果你位于异次元地点，改为 -3）。', delta: -2 },
    cultist: { text: '再揭示一个混乱标记。如果你检定失败，弃掉遭遇牌库顶 5 张卡牌。', delta: 0 },
    tablet: { text: '-3。如果你检定失败，那赫卜攻击你（无视她的地点）。', delta: -3 },
    elderthing: { text: '-4。结算场上每个敌人的猎手关键词。', delta: -4 },
  },
})

export { hasTrait }
