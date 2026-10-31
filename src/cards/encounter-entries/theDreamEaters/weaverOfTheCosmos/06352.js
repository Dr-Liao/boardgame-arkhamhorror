// 06352 黑暗中的织网者（诡计，2 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Revelation - 附属到最近的[[古神]]敌人。附属的敌人 +1 伤害与 +1 恐惧。
//       [action]：检定任意技能(5)。成功则弃掉黑暗中的织网者。
// 接线：encounterResolve 按 BFS 距离挑选最近的古神敌人并用 api.attachStoryAssetToEnemy 挂上；
//   伤害/恐惧加值与摆脱检定写成 flags，由章节 behavior.enemyAttackModifier / actions /
//   performAction 读取（本卡只在 weaverOfTheCosmos 出现，章节可直接接线）。
const TRAIT = 'ancient one'

function distanceMap(state, from) {
  const distance = new Map([[from, 0]])
  const queue = [from]
  for (const current of queue) {
    const location = (state.locations || []).find(item => item.id === current)
    for (const next of location?.connections || []) {
      if (distance.has(next) || !(state.locations || []).some(item => item.id === next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance
}

export default {
  code: '06352',
  scope: 'treachery',
  implemented: true,
  // weaverOfTheCosmos.behavior 已接线：enemyAttackModifier 读 flags.enemyAttackBonus；
  // actions/performAction 读 flags.discardSkillTest（检定任意技能(5)成功后弃掉本卡）。
  flags: {
    enemyAttackBonus: { damage: 1, horror: 1 },
    discardSkillTest: { difficulty: 5, skills: ['willpower', 'intellect', 'combat', 'agility'] },
  },
  encounterResolve(state, inv, card, api) {
    const ancients = (state.enemies || []).filter(enemy =>
      (enemy.traits || []).some(trait => String(trait).toLowerCase() === TRAIT))
    if (!ancients.length) {
      api.info?.('场上没有[[古神]]敌人，「黑暗中的织网者」没有可附属的目标。')
      return false
    }
    const distance = distanceMap(state, inv.location)
    const ranked = ancients
      .map(enemy => ({ enemy, steps: distance.get(enemy.location) ?? Infinity }))
      .sort((left, right) => left.steps - right.steps)
    const target = ranked[0].enemy
    api.attachStoryAssetToEnemy?.('06352', target.id, { originalCode: '06352' })
    api.info?.(`🕷️ 「黑暗中的织网者」附属到最近的[[古神]]敌人「${target.name}」：其 +1 伤害与 +1 恐惧。`)
    return true
  },
}
