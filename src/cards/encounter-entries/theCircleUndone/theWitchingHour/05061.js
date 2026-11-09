// 05061 女巫作祟之林·孩童的树屋（Child’s Tree House）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：强制 - 在本地点最后一个线索被发现时：把遭遇弃牌堆最顶部的敌人生成在此（没有则弃遭遇牌库直到敌人）。
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
  code: '05061', scope: 'location', implemented: true,
  locationRule: {
    cluesRemoved(state, location, amount, api) {
      if ((amount || 0) <= 0 || location.clues > 0) return
      const isEnemy = code => ALL_CARDS[code]?.type === 'enemy'
      // 遭遇弃牌堆/牌库的读写收口到 api（条目不得直写 state.*）。
      const discard = api.encounterDiscardCards?.() || [...(state.encounterDiscard || [])]
      let code = null
      for (let index = discard.length - 1; index >= 0; index--) {
        if (!isEnemy(discard[index])) continue
        code = discard[index]
        api.takeEncounterDiscard?.(code)
        break
      }
      if (!code) {
        const deck = api.encounterDeckCards?.() || [...(state.encounterDeck || [])]
        while (deck.length) {
          const top = deck[deck.length - 1]
          api.takeEncounterDeckCard?.(top)
          if (isEnemy(top)) { code = top; break }
          api.discardEncounterCards?.(top)
          deck.pop()
        }
      }
      if (!code) {
        api.info?.('🏚️ 孩童的树屋：没有可生成的敌人。')
        return
      }
      api.spawn?.(code, location.id)
      api.info?.(`🏚️ 孩童的树屋：${ALL_CARDS[code]?.nameZh || code} 在本地生成。`)
    },
  },
}
