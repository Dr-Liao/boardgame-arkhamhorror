// 06270 · 《无归之地》诡计「意外伏击」（Unexpected Ambush ×2）。
// 卡面：Revelation - If there are no enemies in play, take 1 damage and 1 horror.
//   Otherwise, test [intellect] (4) or [agility] (4). If you fail, the nearest enemy readies, moves
//   (one location at a time) until it reaches your location, and engages you. Then, if you failed by
//   3 or more, it makes an immediate attack.
//
// 检定用 api.test；技能二选一走 api.choose；敌人移动用 api.stepToward + api.moveEnemy（逐地点）。

const SKILL_LABELS = { intellect: '智力', agility: '敏捷' }

function nearestEnemy(state, inv) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
  const here = enemies.find(enemy => enemy.location === inv.location)
  if (here) return here
  const location = (state.locations || []).find(entry => entry.id === inv.location)
  const neighbors = new Set(location?.connections || [])
  return enemies.find(enemy => neighbors.has(enemy.location)) || null
}

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
      const failedBy = Math.max(0, 4 - Number(result.value ?? 0))
      const enemy = nearestEnemy(state, inv)
      if (!enemy) return
      api.readyEnemy?.(enemy)
      let guard = 0
      while (enemy.location !== inv.location && guard < 12) {
        const next = api.stepToward?.(enemy.location, inv.location)
        if (!next || next === enemy.location) break
        api.moveEnemy?.(enemy, next)
        guard += 1
      }
      api.engage?.(enemy, inv.seat)
      api.info?.(`⚔️ 「${enemy.name}」重整后移动到「${inv.name}」所在地点并与其交战。`)
      if (failedBy >= 3) {
        api.attack?.(enemy, state.investigators?.[inv.seat])
        api.info?.(`⚔️ 检定失败差值 ≥3：「${enemy.name}」立即攻击。`)
      }
    })
    return false
  },
}
