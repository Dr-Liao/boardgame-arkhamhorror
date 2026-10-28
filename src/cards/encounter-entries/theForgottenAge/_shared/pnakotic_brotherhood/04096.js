// 04096 阴影笼罩
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：pnakotic_brotherhood
// 卡面：显现 - 如果场上没有[[异教徒]]敌人，受到1点恐惧，且阴影笼罩获得涌动。否则，找到离你最近的[[异教徒]]敌人。在该敌人上放置1个毁灭标记并检定[willpower](X)，其中X等于该敌人的攻击值。如果你检定失败，受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { hasTrait, entryDistance } from '../../../_shared.js'

export default {
  code: '04096', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
    if (!cultists.length) {
      api.horror(inv.seat, 1)
      api.drawEncounter(inv.seat)
      return false
    }
    const scored = cultists.map(enemy => ({ enemy, steps: entryDistance(state, inv.location, enemy.location) }))
    const nearest = Math.min(...scored.map(entry => entry.steps))
    const tied = scored.filter(entry => entry.steps === nearest).map(entry => entry.enemy)
    let target = tied[0]
    if (tied.length > 1) {
      const answer = api.choose({
        kind: 'target', source: '04096', seat: inv.seat,
        prompt: '选择离你最近的异教徒敌人。',
        options: tied.map((enemy, index) => ({ id: String(index), enemyId: enemy.id, label: enemy.name })),
      })
      target = tied[Number(answer)] || target
    }
    if (target) target.doom = (target.doom || 0) + 1
    // X = 该敌人在结算时的攻击值：走 enemyFightValue 才能算上毁灭修正与场景修正
    // （例如 04140「伊塔卡的猎物」在无线索地点 +1 攻击），而不是只算基础 fight+毁灭。
    const fightValue = target
      ? (typeof api.enemyFight === 'function' ? api.enemyFight(target, inv.seat) : (target.fight || 0) + (target.doom || 0))
      : 3
    api.test(inv.seat, 'willpower', fightValue, result => {
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
