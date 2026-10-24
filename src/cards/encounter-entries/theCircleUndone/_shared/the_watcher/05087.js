// 05087 看守人的攫噬
// 归属：战役共用 · theCircleUndone；遭遇组：the_watcher
// 卡面：显现 - 治愈幽灵看守人的 3 点伤害。重整幽灵看守人。
//   其移动、交战并攻击，如同此刻是敌军阶段。结算本效果期间，幽灵看守人获得「猎物 - 你」。
//
// 近似：敌军阶段三步用「猎手移动一步 → 与所在地点调查员交战 → 攻击」承载；
// 移动路线用引擎 hunterStep 的默认选点；「猎物 - 你」只影响本效果的目标选择
//（优先抽到本卡的调查员），不写入敌人数据（记入 status.json 的 approximations）。

import { activeInvestigators, originalOf } from '../../../_shared.js'

export default {
  code: '05087',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const watcher = (state.enemies || []).find(enemy => originalOf(enemy) === '05086')
    if (!watcher) {
      api.info?.('幽灵看守人不在场：看守人的攫噬没有效果。')
      return false
    }
    watcher.damageTaken = Math.max(0, (watcher.damageTaken || 0) - 3)
    watcher.exhausted = false
    // 1) 像敌军阶段一样移动（猎手步；没有猎手目标时不动）。
    const destination = typeof api.hunterStep === 'function' ? api.hunterStep(watcher) : null
    if (destination && destination !== watcher.location) api.moveEnemy(watcher, destination)
    // 2) 交战：本效果期间猎物 = 抽到本卡的调查员（若它在同地点），否则取所在地点的第一位调查员。
    const here = activeInvestigators(state).filter(target => target.location === watcher.location)
    const target = here.find(candidate => candidate.seat === inv.seat) || here[0] || null
    if (target) {
      const previous = watcher.engagedSeat == null ? null : state.investigators[watcher.engagedSeat]
      if (previous && previous.seat !== target.seat) {
        previous.engaged = (previous.engaged || []).filter(id => id !== watcher.id)
      }
      watcher.engagedSeat = target.seat
      target.engaged = [...new Set([...(target.engaged || []), watcher.id])]
      // 3) 攻击（如同敌军阶段）。
      api.attack(watcher, target)
    }
    api.info?.('👁️ 幽灵看守人治愈 3 点伤害、重整，并移动、交战、攻击。')
    return false // 本卡进遭遇弃牌堆
  },
}
