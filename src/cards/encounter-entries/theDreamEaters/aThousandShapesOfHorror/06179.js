// 06179 地点「藏书室」（Library · 背面「楼上的门道」Upstairs Doorway）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 作为调查藏书室的额外费用，你必须失去 1 个行动或受到 1 点恐惧。
// [fast] 位于藏书室的调查员共同花费 1[per_investigator] 个线索：翻阅到一篇关于墓地中坟墓的古怪日志。
// 将放在一边的无名坟墓地点放置入场。
//
// 依据 Haskell Location/Cards/.../UpstairsDoorwayLibrary.hs：
//   · 调查额外费用（行动或恐惧）→ locationRule.beforeInvestigate（behavior.beforeInvestigate 在扣行动前调用）；
//   · [fast] 团队线索行动 → actions/performAction（api.takeFromSetAside + api.place）。
import { activeInvestigators, originalOf } from '../../_shared.js'

const LIBRARY = '06179'
const UNMARKED_TOMB = '06182'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

const locationByCode = (state, code) => (state.locations || []).find(location => String(originalOf(location)) === code) || null

export default {
  code: LIBRARY,
  scope: 'location',
  implemented: true,
  locationRule: {
    // 作为调查的额外费用：失去 1 个行动，或受到 1 点恐惧（有行动时二选一，没有行动时只能受恐惧）。
    beforeInvestigate(state, inv, location, api) {
      if (inv.location !== location.id) return true
      const canPayAction = Number(inv.actionsLeft || 0) > 0
      const options = []
      if (canPayAction) options.push({ id: 'action', label: '失去 1 个行动' })
      options.push({ id: 'horror', label: '受到 1 点恐惧' })
      const answer = options.length === 1 ? options[0].id : api.choice?.({
        kind: 'cost', source: LIBRARY, seat: inv.seat,
        prompt: '调查藏书室的额外费用：失去 1 个行动，或受到 1 点恐惧。', options,
      })
      if (answer === 'action' && canPayAction) {
        api.loseActions?.(inv.seat, 1)
        api.info?.(`📚 藏书室：${inv.name} 失去 1 个行动作为调查的额外费用。`)
      } else {
        api.horror?.(inv.seat, 1)
        api.info?.(`📚 藏书室：${inv.name} 受到 1 点恐惧作为调查的额外费用。`)
      }
      return true
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (locationByCode(state, UNMARKED_TOMB)) return
      const required = state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'tshPlaceUnmarkedTombFromLibrary',
        actions: 0,
        fast: true,
        label: `📖 藏书室：共同花费 ${required} 个线索，把「无名坟墓」放置入场`,
        ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshPlaceUnmarkedTombFromLibrary') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      const required = state.numInvestigators
      if (!location || groupCluesAt(state, location) < required) return false
      if (locationByCode(state, UNMARKED_TOMB)) return false
      const definition = Object.values(state.scenario?.locations || {}).find(card => String(originalOf(card)) === UNMARKED_TOMB)
      if (!definition) return false
      api.payClues?.(required, location.id)
      api.takeFromSetAside?.(UNMARKED_TOMB)
      api.place?.(definition.id)
      api.info?.('📖 藏书室：调查员在一篇古怪的日志里读到墓地中的坟墓，「无名坟墓」被放置入场。')
      return true
    },
  },
}
