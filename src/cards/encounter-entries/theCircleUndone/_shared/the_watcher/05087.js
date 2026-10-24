// 05087 看守人的攫噬
// 归属：战役共用 · theCircleUndone；遭遇组：the_watcher
// 卡面：显现 - 治愈幽灵看守人的 3 点伤害。重整幽灵看守人。
//   其移动、交战并攻击，如同此刻是敌军阶段。结算本效果期间，幽灵看守人获得「猎物 - 你」。
//
// 结算口径（按敌军阶段三步）：
//   1) 猎手移动：只有「重整、未交战、且所在地点没有调查员」时才移动一步；目标按「猎物 - 你」
//      （抽到本卡的调查员）计算——与 engine/turn.js 的 hunter 步一致；
//   2) 交战：未交战则在其所在地点交战一位调查员（优先抽到本卡的调查员，即「猎物 - 你」）；
//   3) 攻击：攻击其交战对象一次（如同敌军阶段；未交战/无目标则不攻击）。
// 结算期间把 preySeat 临时写成抽牌者，结束后恢复，供其它读取 prey 的效果看到这次临时猎物。

import { activeInvestigators, originalOf } from '../../../_shared.js'

const WATCHER = '05086'

export default {
  code: '05087',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const watcher = (state.enemies || []).find(enemy => originalOf(enemy) === WATCHER)
    if (!watcher) {
      api.info?.('幽灵看守人不在场：看守人的攫噬没有效果。')
      return false
    }
    watcher.damageTaken = Math.max(0, (watcher.damageTaken || 0) - 3)
    watcher.exhausted = false
    const hadPreySeat = Object.prototype.hasOwnProperty.call(watcher, 'preySeat')
    const savedPreySeat = watcher.preySeat
    watcher.preySeat = inv.seat // 结算期间「猎物 - 你」。
    try {
      // 1) 猎手移动：与敌军阶段同条件——已交战/所在地点已有调查员时不移动。
      const hereBefore = activeInvestigators(state).filter(target => target.location === watcher.location)
      const canHunt = watcher.hunter !== false && watcher.engagedSeat == null && hereBefore.length === 0
      if (canHunt && typeof api.hunterStep === 'function') {
        const destination = api.hunterStep(watcher, { targets: [inv] })
        if (destination && destination !== watcher.location) {
          api.moveEnemy(watcher, destination)
          api.info?.(`👁️ 幽灵看守人向「${destination}」移动。`)
        }
      } else if (hereBefore.length > 0) {
        api.info?.('👁️ 幽灵看守人所在地点已有调查员：跳过猎手移动。')
      }
      // 2) 交战：未交战时在其所在地点交战一位调查员（优先抽牌者 = 猎物 - 你）。
      if (watcher.engagedSeat == null) {
        const here = activeInvestigators(state).filter(target => target.location === watcher.location)
        const target = here.find(candidate => candidate.seat === inv.seat) || here[0] || null
        if (target) {
          watcher.engagedSeat = target.seat
          target.engaged = [...new Set([...(target.engaged || []), watcher.id])]
          api.info?.(`👁️ 幽灵看守人与 ${target.name} 交战。`)
        }
      }
      // 3) 攻击：敌军阶段一名敌人攻击其交战调查员一次。
      const engaged = watcher.engagedSeat != null ? state.investigators[watcher.engagedSeat] : null
      if (engaged && !engaged.defeated && !engaged.resigned) {
        if (api.cannotAttack?.(watcher)) return false
        api.attack(watcher, engaged)
      }
      api.info?.('👁️ 幽灵看守人治愈 3 点伤害、重整，并移动、交战、攻击。')
    } finally {
      if (hadPreySeat) watcher.preySeat = savedPreySeat
      else delete watcher.preySeat
    }
    return false // 本卡进遭遇弃牌堆
  },
}
