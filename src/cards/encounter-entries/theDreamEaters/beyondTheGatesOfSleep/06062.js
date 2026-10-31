// 06062 森林迷途（Lost in the Woods）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：涌动。显现 - 位于「魔幻森林」地点的每位调查员检定意志(3)。失败的调查员失去 1 个行动并受到 1 点恐惧。
// 读点：encounterResolve（共享 encounter-rules.js 的 resolveEncounter 分派）。
// 涌动由 definition 从印刷卡文解析；条目内声明 surge 作防御性冗余（读点 encounter.js）。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const CODE = '06062'
const WOODS_NAME = 'Enchanted Woods'

function isEnchantedWoods(state, locationId) {
  const location = (state.locations || []).find(entry => entry.id === locationId)
  if (!location) return false
  const card = ALL_CARDS[originalOf(location)]
  return (card?.nameEn || location.name) === WOODS_NAME
    || (card?.text || '').includes('Enchanted Woods')
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { surge: true },
  encounterResolve(state, inv, card, api) {
    const targets = activeInvestigators(state).filter(entry => isEnchantedWoods(state, entry.location))
    if (!targets.length) {
      api.info?.('🌲 森林迷途：没有调查员位于魔幻森林，无事发生。')
      return false
    }
    api.info?.(`🌲 森林迷途：${targets.map(entry => entry.name).join('、')} 在魔幻森林中迷失方向。`)
    for (const target of targets) {
      api.test?.(target.seat, 'willpower', 3, result => {
        if (result.success) return
        api.loseActions?.(target.seat, 1)
        api.horror?.(target.seat, 1)
      })
    }
    return false
  },
}
