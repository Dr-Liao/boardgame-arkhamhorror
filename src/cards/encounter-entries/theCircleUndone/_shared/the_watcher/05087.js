// 05087 看守人的攫噬
// 归属：战役共用 · theCircleUndone；遭遇组：the_watcher
// 卡面：显现 - 治愈幽灵看守人的 3 点伤害。重整幽灵看守人。
//   其移动、交战并攻击，如同此刻是敌军阶段。结算本效果期间，幽灵看守人获得「猎物 - 你」。
//
// 结算口径 = 引擎敌军阶段的三个步骤（src/engine/turn.js 的 enemyPhase）：
//   1) 猎手移动：与敌军阶段同一门控（猎手、未交战、非横置/immobile、所在地点没有调查员），
//      调 api.hunterStep(enemy) **不传 targets**，由引擎按「最近调查员」选路；
//      并列时引擎读 enemy.preySeat（src/engine/turn.js 的 hunterStep）——本效果期间写「你」。
//   2) 交战：等价 autoEngageAll（src/engine/engine.js:620-632）：未交战时对所在地点调查员
//      调 api.preyTarget(enemy, seats)，优先采用结算期的 preySeat（=「你」）。
//   3) 攻击：等价敌军阶段攻击（非横置、非 massive 攻击后横置）。
// 结算期间把 preySeat 临时写成抽牌者，结束后恢复原值。

import { activeInvestigators, originalOf } from '../../../_shared.js'

const WATCHER = '05086'

function locationOf(state, inv) {
  return (state.locations || []).find(location => location.id === inv?.location) || null
}

function activeInvestigatorsAt(state, locationId) {
  return activeInvestigators(state).filter(target => target.location === locationId)
}

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
    api.healEnemy?.(watcher, 3)
    api.readyEnemy?.(watcher)
    const here = locationOf(state, inv)
    const hadPreySeat = Object.prototype.hasOwnProperty.call(watcher, 'preySeat')
    const savedPreySeat = watcher.preySeat
    // 结算期间「猎物 - 你」：写实例读点，供 hunterStep 的并列裁决与 preyTarget 的交战选择读取。
    api.setEnemyPreySeat?.(watcher, inv.seat)
    try {
      // 1) 猎手移动（与敌军阶段同一门控与目标选择，不强制朝抽牌者）。
      const hereBefore = activeInvestigatorsAt(state, watcher.location)
      const canHunt = Boolean(watcher.hunter) && watcher.engagedSeat == null
        && !watcher.exhausted && !watcher.immobile && hereBefore.length === 0
      if (canHunt && typeof api.hunterStep === 'function') {
        const destination = api.hunterStep(watcher)
        if (destination && destination !== watcher.location) {
          api.moveEnemy(watcher, destination)
          api.info?.(`👁️ 幽灵看守人向「${destination}」移动。`)
        }
      } else if (hereBefore.length > 0) {
        api.info?.('👁️ 幽灵看守人所在地点已有调查员：跳过猎手移动。')
      }
      // 2) 交战（等价 enemy phase 的 autoEngageAll）。
      if (watcher.engagedSeat == null) {
        const seats = activeInvestigatorsAt(state, watcher.location).map(target => target.seat)
        const targetSeat = api.preyTarget?.(watcher, seats)
        if (Number.isInteger(targetSeat)) {
          api.engage(watcher, targetSeat)
          api.info?.(`👁️ 幽灵看守人与 ${state.investigators[targetSeat]?.name || targetSeat} 交战。`)
        }
      }
      // 3) 攻击（等价敌军阶段：横置的敌人不攻击；攻击后非 massive 横置）。
      const engaged = watcher.engagedSeat != null ? state.investigators[watcher.engagedSeat] : null
      if (engaged && !engaged.defeated && !engaged.resigned && !watcher.exhausted) {
        if (api.cannotAttack?.(watcher)) return false
        api.attack(watcher, engaged)
        if (!watcher.massive) api.exhaustEnemy?.(watcher)
      }
      api.info?.('👁️ 幽灵看守人治愈 3 点伤害、重整，并移动、交战、攻击。')
    } finally {
      api.setEnemyPreySeat?.(watcher, hadPreySeat ? savedPreySeat : null)
    }
    if (here) api.info?.(`👁️ 「${here.name || inv.location}」的幽灵看守人结算完毕。`)
    return false // 本卡进遭遇弃牌堆
  },
}
