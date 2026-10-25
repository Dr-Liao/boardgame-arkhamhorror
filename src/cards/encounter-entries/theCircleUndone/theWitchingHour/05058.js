// 05058 女巫作祟之林·废弃矿山（Abandoned Mine）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：你拥有 3–10 点资源时不能调查本地点；[free] 团队每轮一次，与另一处女巫作祟之林的调查员互移最多 3 点资源。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

const WOODS_ENCOUNTER = 'the_witching_hour'
const isWitchHauntedWoods = card => {
  const original = originalOf(card)
  const data = ALL_CARDS[original]
  return data?.encounterCode === WOODS_ENCOUNTER && data?.type === 'location' && original !== '05055b'
}
const woodsInPlay = state => state.locations.filter(isWitchHauntedWoods)
// 「另一处女巫作祟之林」：必须与自己在不同的森林地点（同地点不算）。
const otherWoodsInvestigators = (state, inv) => activeInvestigators(state)
  .filter(other => other.seat !== inv.seat && other.location !== inv.location
    && woodsInPlay(state).some(loc => loc.id === other.location))

export default {
  code: '05058', scope: 'location', implemented: true,
  locationRule: {
    investigationError(state, location, inv) {
      const resources = Number(inv?.resources ?? 0)
      if (resources >= 3 && resources <= 10) {
        return '「废弃矿山」：你拥有 3–10 点资源，不能调查本地点。'
      }
      return undefined
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      // [free]：不花行动，可在任意玩家窗口触发（behavior.fastActions → 引擎 playerWindow）。
      // 卡面「团队每轮仅限一次」→ 全队共享的 mineSwapRound（不是按座位）。
      if (state.scenarioFlags?.mineSwapRound === state.round) return
      if (!otherWoodsInvestigators(state, inv).length) return
      moves.push({
        action: 'scenarioAction', rule: 'mineSwapResources', actions: 0, fast: true,
        label: '⛏️ 废弃矿山：与另一处女巫作祟之林的调查员交换最多 3 点资源（团队每轮一次）',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'mineSwapResources') return false
      const others = otherWoodsInvestigators(state, inv)
      if (!others.length) return false
      if (state.scenarioFlags?.mineSwapRound === state.round) return false
      const picked = others.length === 1 ? others[0] : others.find(other => String(other.seat) === String(api.choose?.({
        kind: 'investigator', source: '05058', seat: inv.seat,
        prompt: '选择另一处女巫作祟之林的一位调查员。',
        options: others.map(other => ({ id: String(other.seat), label: other.name })),
      }))) || others[0]
      const direction = api.choose?.({
        kind: 'story', source: '05058', seat: inv.seat,
        prompt: '资源移动方向。',
        options: [
          { id: 'toThem', label: '把你的资源交给对方' },
          { id: 'toMe', label: '把对方的资源交给你' },
        ],
      }) || 'toThem'
      const available = Math.min(3, direction === 'toThem' ? (inv.resources || 0) : (picked.resources || 0))
      if (available <= 0) return true
      const answer = api.choose?.({
        kind: 'amount', source: '05058', seat: inv.seat,
        prompt: '选择要移动的资源数量。',
        options: Array.from({ length: available }, (_, index) => ({ id: String(index + 1), label: String(index + 1) + ' 点资源' })),
      }) || String(available)
      const amount = Math.max(1, Math.min(available, Number(answer) || 1))
      if (direction === 'toThem') { inv.resources -= amount; picked.resources = (picked.resources || 0) + amount }
      else { picked.resources -= amount; inv.resources = (inv.resources || 0) + amount }
      state.scenarioFlags ||= {}
      // 团队每轮仅限一次：全队共享一个轮次标记。
      state.scenarioFlags.mineSwapRound = state.round
      api.info?.(`⛏️ ${inv.name} 与 ${picked.name} 交换了 ${amount} 点资源。`)
      return true
    },
  },
}
