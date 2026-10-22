// 04302 蛇族的愤怒
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：显现 - 如果没有[[蛇族]]敌人处于追击中，蛇族的愤怒获得涌动。否则，找出攻击值最高且处于追击中的[[蛇族]]敌人，它生成并与你交战。如果有敌人以此效果生成，检定[agility](X)，X为该敌人的攻击值。如果你检定失败，该敌人立即攻击你。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 蛇族的愤怒（04302）：追击区没有蛇族敌人则涌动，否则把攻击值最高的蛇族拽出来交战。

import { isPursuitSerpent, pursuitFightOf } from '../../_shared.js'

export default {
  code: '04302', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  name: '蛇族的愤怒',
  text: '显现 - 如果没有[[蛇族]]敌人处于追击中，本卡获得涌动。否则攻击值最高且处于追击中的[[蛇族]]敌人生成并与你交战。',
  encounterResolve(state, inv, card, api) {
    state.scenarioZones ||= {}
    const pursuit = state.scenarioZones.pursuit || []
    const serpents = pursuit.filter(entry => isPursuitSerpent(state, entry.code))
    if (!serpents.length) {
      api.info?.('蛇族的愤怒：追击区域没有蛇族敌人，本卡获得涌动。')
      api.drawEncounter(inv.seat)
      return { placed: false, surgeHandled: true }
    }
    const best = Math.max(...serpents.map(entry => pursuitFightOf(state, entry.code)))
    const chosen = serpents.filter(entry => pursuitFightOf(state, entry.code) === best)[0]
    const index = pursuit.indexOf(chosen)
    if (index >= 0) pursuit.splice(index, 1)
    const enemy = api.spawn(chosen.code, inv.location)
    if (!enemy) {
      pursuit.push(chosen)
      return { placed: false, surgeHandled: true }
    }
    enemy.damageTaken = chosen.damageTaken || 0
    if (!enemy.exhausted) {
      if (typeof api.engage === 'function') api.engage(enemy, inv.seat)
      else {
        enemy.engagedSeat = inv.seat
        if (!inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
      }
    }
    const location = state.locations.find(candidate => candidate.id === inv.location)
    api.info?.(`蛇族的愤怒：「${enemy.name}」在「${location?.name || inv.location}」生成并与 ${inv.name} 交战。`)
    const difficulty = enemy.fight || 0
    api.test(inv.seat, 'agility', difficulty, result => {
      if (result.success) return
      if (!state.enemies.includes(enemy)) return
      api.attack(enemy, inv)
    })
    return { placed: false, surgeHandled: true }
  },
}
