// 05060 女巫作祟之林·独木（The Lonely Tree）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：你拥有 3–5 张手牌时不能调查本地点；[free] 每轮一次，你弃 1 张手牌让对方抽 1 张，或反过来。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

const WOODS_ENCOUNTER = 'the_witching_hour'
const isWitchHauntedWoods = card => {
  const original = originalOf(card)
  const data = ALL_CARDS[original]
  return data?.encounterCode === WOODS_ENCOUNTER && data?.type === 'location' && original !== '05055b'
}
const woodsInPlay = state => state.locations.filter(isWitchHauntedWoods)
const otherWoodsInvestigators = (state, inv) => activeInvestigators(state)
  .filter(other => other.seat !== inv.seat && woodsInPlay(state).some(loc => loc.id === other.location))

export default {
  code: '05060', scope: 'location', implemented: true,
  locationRule: {
    investigationError(state, location, inv) {
      const hand = (inv?.hand || []).length
      if (hand >= 3 && hand <= 5) return '「独木」：你拥有 3–5 张手牌，不能调查本地点。'
      return undefined
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.lonelyTreeRound === state.round) return
      if (!otherWoodsInvestigators(state, inv).length) return
      moves.push({
        action: 'scenarioAction', rule: 'lonelyTreeSwap',
        label: '🌳 独木：与另一处女巫作祟之林的调查员交换一张手牌（每轮一次）',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'lonelyTreeSwap') return false
      const others = otherWoodsInvestigators(state, inv)
      if (!others.length) return false
      const picked = others.length === 1 ? others[0] : others.find(other => String(other.seat) === String(api.choose?.({
        kind: 'investigator', source: '05060', seat: inv.seat,
        prompt: '选择另一处女巫作祟之林的一位调查员。',
        options: others.map(other => ({ id: String(other.seat), label: other.name })),
      }))) || others[0]
      const direction = api.choose?.({
        kind: 'story', source: '05060', seat: inv.seat, canSkip: true,
        prompt: '由谁弃牌？',
        options: [
          { id: 'youDiscardTheyDraw', label: '你弃 1 张手牌，对方抽 1 张' },
          { id: 'viceVersa', label: '对方弃 1 张手牌，你抽 1 张' },
        ],
      })
      if (!direction) return false
      state.scenarioFlags.lonelyTreeRound = state.round
      if (direction === 'youDiscardTheyDraw') {
        api.discardRandom?.(inv.seat, 1)
        api.drawCards?.(picked.seat, 1)
        api.info?.(`🌳 ${inv.name} 弃掉 1 张手牌，${picked.name} 抽取 1 张。`)
      } else {
        api.discardRandom?.(picked.seat, 1)
        api.drawCards?.(inv.seat, 1)
        api.info?.(`🌳 ${picked.name} 弃掉 1 张手牌，${inv.name} 抽取 1 张。`)
      }
      return true
    },
  },
}
