// 06177 地点「客厅」（Parlor · 背面「楼下的门道」Downstairs Doorway）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：每有一位调查员位于客厅，其得到隐藏值 +1。
// [fast] 如果不可名状之物上有至少 2[per_investigator] 点伤害：镜子不自然地闪着光芒，
// 露出一抹银光。记住调查员「发现了一把奇怪的钥匙」。
//
// 依据 Haskell Location/Cards/.../DownstairsDoorwayParlor.hs：
//   · 隐藏值 = 印刷 2 + 位于客厅的调查员数 → locationRule.shroudModifier（behavior.locationShroudModifier 分派）；
//   · [fast] 条件行动（无费用）→ actions/performAction；「记住」记入 scenarioFlags.remembered。
import { ALL_CARDS, activeInvestigators, originalOf, rememberFact } from '../../_shared.js'

const PARLOR = '06177'
const THE_UNNAMABLE = '06169b'
const FACT = 'recoveredAStrangeKey'

const unnamableDamage = state => {
  const unnamable = (state.enemies || []).find(enemy => String(originalOf(enemy)) === THE_UNNAMABLE)
  return unnamable ? Number(unnamable.damageTaken) || 0 : 0
}

export default {
  code: PARLOR,
  scope: 'location',
  implemented: true,
  locationRule: {
    // +1 隐藏值 / 每位位于客厅的调查员（与印刷 2 相加）。
    shroudModifier(state, location) {
      return activeInvestigators(state).filter(inv => inv.location === location.id).length
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if ((state.scenarioFlags?.remembered || []).includes(FACT)) return
      const threshold = 2 * Math.max(1, Number(state.numInvestigators) || 1)
      if (unnamableDamage(state) < threshold) return
      moves.push({
        action: 'scenarioAction',
        rule: 'tshRememberStrangeKeyParlor',
        actions: 0,
        fast: true,
        label: '🪞 客厅：镜子不自然地闪着光芒，记住「发现了一把奇怪的钥匙」',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshRememberStrangeKeyParlor') return false
      const threshold = 2 * Math.max(1, Number(state.numInvestigators) || 1)
      if (unnamableDamage(state) < threshold) return false
      rememberFact(state, FACT)
      api.info?.(`🪞 客厅：调查员记住了「发现了一把奇怪的钥匙」（${ALL_CARDS[THE_UNNAMABLE]?.nameZh || '不可名状之物'} 的伤害已足够）。`)
      return true
    },
  },
}
