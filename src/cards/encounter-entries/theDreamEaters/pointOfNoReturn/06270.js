// 06270 · 《无归之地》诡计「意外伏击」（Unexpected Ambush ×2）。
// 卡面：Revelation - If there are no enemies in play, take 1 damage and 1 horror.
//   Otherwise, test [intellect] (4) or [agility] (4). If you fail, the nearest enemy readies, moves
//   (one location at a time) until it reaches your location, and engages you. Then, if you failed by
//   3 or more, it makes an immediate attack.
//
// 使用共用的最近敌人查询，按一次一个地点的效果移动结算。

import { failedBy } from '../../_shared.js'

const SKILL_LABELS = { intellect: '智力', agility: '敏捷' }

export default {
  code: '06270',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
    if (!enemies.length) {
      api.damage?.(inv.seat, 1)
      api.horror?.(inv.seat, 1)
      api.info?.('「意外伏击」：场上没有敌人，受到 1 点伤害和 1 点恐惧。')
      return false
    }
    const skills = Object.keys(SKILL_LABELS)
    const answer = String(api.choose?.({
      kind: 'skill', source: '06270', seat: inv.seat,
      prompt: '「意外伏击」：选择检定技能（智力(4) 或 敏捷(4)）。',
      options: skills.map(skill => ({ id: skill, label: SKILL_LABELS[skill] })),
    }) ?? skills[0])
    const skill = skills.includes(answer) ? answer : skills[0]
    api.test?.(inv.seat, skill, 4, result => {
      if (result.success) return
      const enemies = api.nearestEnemies(inv)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choose({
        kind: 'enemy', source: '06270', seat: inv.seat,
        prompt: '选择一位最近的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })
      const enemy = enemies.find(candidate => candidate.id === id)
      if (!enemy) return
      api.readyEnemy(enemy)
      const visited = new Set()
      while (enemy.location !== inv.location) {
        if (visited.has(enemy.location)) return
        visited.add(enemy.location)
        if (!api.moveEnemyToward(enemy, inv.location, { source: '06270', skipAutoEngage: true })?.moved) return
      }
      if (!state.enemies.includes(enemy)) return
      api.engage(enemy, inv.seat)
      api.info?.(`⚔️ 「${enemy.name}」重整后移动到「${inv.name}」所在地点并与其交战。`)
      if (failedBy(result, 4) >= 3) {
        api.attack?.(enemy, state.investigators?.[inv.seat])
        api.info?.(`⚔️ 检定失败差值 ≥3：「${enemy.name}」立即攻击。`)
      }
    })
    return false
  },
}
