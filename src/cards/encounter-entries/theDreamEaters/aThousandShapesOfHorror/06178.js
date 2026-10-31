// 06178 地点「楼上的走廊」（Upstairs Hallway · 背面「楼上的走廊」，未揭示面不能进入）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：恶臭让你不敢上楼。你不能进入楼上的走廊。
// （未揭示面的文本）；揭示面：[fast] 位于楼上的走廊的调查员共同花费 1[per_investigator] 个线索：
// 将放在一边的阁楼地点放置入场。
//
// 依据 Haskell Location/Cards/.../UpstairsHallway.hs：
//   · 未揭示时 Blocked → locationRule.entryErrorWhenUnrevealed（behavior.investigatorEntryError 分派）；
//   · [fast] 团队线索行动 → actions/performAction（api.takeFromSetAside + api.place）。
import { activeInvestigators, originalOf } from '../../_shared.js'

const UPSTAIRS_HALLWAY = '06178'
const ATTIC = '06181'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

const locationByCode = (state, code) => (state.locations || []).find(location => String(originalOf(location)) === code) || null

export default {
  code: UPSTAIRS_HALLWAY,
  scope: 'location',
  implemented: true,
  locationRule: {
    entryErrorWhenUnrevealed: '「楼上的走廊」：恶臭让你不敢上楼，未揭示时不能进入本地点。',
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id || location.revealed !== true) return
      if (locationByCode(state, ATTIC)) return
      const required = state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'tshPlaceAtticFromHallway',
        actions: 0,
        fast: true,
        label: `🪜 楼上的走廊：共同花费 ${required} 个线索，把「阁楼」放置入场`,
        ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshPlaceAtticFromHallway') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      const required = state.numInvestigators
      if (!location || location.revealed !== true || groupCluesAt(state, location) < required) return false
      if (locationByCode(state, ATTIC)) return false
      const definition = Object.values(state.scenario?.locations || {}).find(card => String(originalOf(card)) === ATTIC)
      if (!definition) return false
      api.payClues?.(required, location.id)
      api.takeFromSetAside?.(ATTIC)
      api.place?.(definition.id)
      api.info?.(`🪜 楼上的走廊：调查员共同花费 ${required} 个线索，「阁楼」被放置入场。`)
      return true
    },
  },
}
