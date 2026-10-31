// 06175 地点「入口」（Entryway · 背面「前廊」Front Porch）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// [fast] 位于入口的调查员共同花费 1[per_investigator] 个线索：揭示楼上的走廊。
// [fast] 如果不可名状之物上有至少 1[per_investigator] 点伤害：将放在一边的无名坟墓地点放置入场。
//
// 依据 Haskell Location/Cards/.../FrontPorchEntryway.hs：
//   · 两条都是 [fast]（团队线索费用 + 条件放置）→ locationRule.actions / performAction；
//   · 「揭示楼上的走廊」走 api.reveal（在本章 behavior.setupLocations 之后该地点已在场、未揭示）；
//   · 「把放在一边的无名坟墓放置入场」走 api.takeFromSetAside + api.place，并查重（同名地点只放 1 张）。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const ENTRYWAY = '06175'
const THE_UNNAMABLE = '06169b'
const UPSTAIRS_HALLWAY = '06178'
const UNMARKED_TOMB = '06182'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

const locationByCode = (state, code) => (state.locations || []).find(location => String(originalOf(location)) === code) || null

// 不可名状之物上的伤害是否达到「1[per_investigator]」。
const unnamableDamageReached = state => {
  const unnamable = (state.enemies || []).find(enemy => String(originalOf(enemy)) === THE_UNNAMABLE)
  if (!unnamable) return 0
  const threshold = Math.max(1, Number(state.numInvestigators) || 1)
  return (Number(unnamable.damageTaken) || 0) >= threshold ? (Number(unnamable.damageTaken) || 0) : 0
}

export default {
  code: ENTRYWAY,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      const hallway = locationByCode(state, UPSTAIRS_HALLWAY)
      if (hallway && hallway.revealed !== true) {
        const required = state.numInvestigators
        moves.push({
          action: 'scenarioAction',
          rule: 'tshRevealUpstairsHallway',
          actions: 0,
          fast: true,
          label: `🚪 入口：共同花费 ${required} 个线索，揭示「${hallway.name || '楼上的走廊'}」`,
          ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
        })
      }
      if (unnamableDamageReached(state) && !locationByCode(state, UNMARKED_TOMB)) {
        moves.push({
          action: 'scenarioAction',
          rule: 'tshPlaceUnmarkedTombFromEntryway',
          actions: 0,
          fast: true,
          label: '🪦 入口：烟雾指向墓地中央的墓穴，放置「无名坟墓」',
        })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'tshRevealUpstairsHallway') {
        const hallway = locationByCode(state, UPSTAIRS_HALLWAY)
        const required = state.numInvestigators
        if (!hallway || hallway.revealed === true) return false
        const location = (state.locations || []).find(item => item.id === inv.location)
        if (!location || groupCluesAt(state, location) < required) return false
        api.payClues?.(required, location.id)
        api.reveal?.(hallway.id)
        api.info?.(`🚪 入口：调查员共同花费 ${required} 个线索，揭示了「${ALL_CARDS[UPSTAIRS_HALLWAY]?.nameZh || '楼上的走廊'}」。`)
        return true
      }
      if (move.rule === 'tshPlaceUnmarkedTombFromEntryway') {
        if (!unnamableDamageReached(state) || locationByCode(state, UNMARKED_TOMB)) return false
        const definition = Object.values(state.scenario?.locations || {}).find(card => String(originalOf(card)) === UNMARKED_TOMB)
        if (!definition) return false
        api.takeFromSetAside?.(UNMARKED_TOMB)
        api.place?.(definition.id)
        api.info?.('🪦 入口：烟雾的尽头指向「无名坟墓」，它被放置入场。')
        return true
      }
      return false
    },
  },
}
