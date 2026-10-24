// 05063 女巫作祟之林·隐士之家（Hermit’s House）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：强制 - 本地点任意数量的线索被发现后：位于本地点的每位调查员随机弃掉相等数量的手牌。
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
  code: '05063', scope: 'location', implemented: true,
  locationRule: {
    cluesRemoved(state, location, amount, api) {
      if (location.clues > 0 || (amount || 0) <= 0) return
      for (const inv of activeInvestigators(state).filter(entry => entry.location === location.id)) {
        api.discardRandom?.(inv.seat, amount)
        api.info?.(`🏚️ 隐士之家：${inv.name} 随机弃掉 ${amount} 张手牌。`)
      }
    },
  },
}
