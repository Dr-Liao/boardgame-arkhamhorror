// 06049 魔幻小路（The Enchanted Path）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：「魔幻小路」与每张「魔幻森林」地点相连。场上每有一张未揭示的「魔幻森林」地点，
//   「魔幻小路」帷幕 +1。[action][action][action]：你按指示做了……但感觉自己错过了什么。
//   从标记池在「魔幻小路」上放置 1 个线索。
//   未揭示面：除非「楼梯底部」上的全部线索都被发现，否则你不能进入「魔幻小路」。
// 读点：entryError（引擎直接读）；connections 由 definition 的符号/固定邻接给出；
//   帷幕动态由章节 behavior.locationShroudModifier 读 locationRule.shroudPerUnrevealedEnchantedWoods；
//   3 行动由 locationRule.actions + performAction 提供，章节 behavior.actions/performAction 分派。
import { originalOf } from '../../_shared.js'

const CODE = '06049'
const WOODS_CODES = ['06050', '06051', '06052', '06053', '06054', '06055', '06056']

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    entryError(state, location, inv) {
      const base = (state.locations || []).find(entry => originalOf(entry) === '06048')
      if (base && Number(base.clues || 0) > 0) {
        return '「魔幻小路」：必须先发现「楼梯底部」上的全部线索，才能进入这里。'
      }
      return undefined
    },
    // 数据声明：章节 behavior.locationShroudModifier 统计场上未揭示的魔幻森林（读 WOODS_CODES）。
    shroudPerUnrevealedEnchantedWoods: { originalCodes: WOODS_CODES },
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({
        action: 'scenarioAction',
        rule: 'enchantedPathPlaceClue',
        actions: 3,
        label: '🌿 魔幻小路：你按指示做了……从标记池在本地点上放置 1 个线索（3 个行动）',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'enchantedPathPlaceClue') return false
      api.addCluesToLocation?.(inv.location, 1)
      api.info?.(`🌿 ${inv.name} 按指示行动：在「魔幻小路」上放置 1 个线索。`)
      return true
    },
  },
}
