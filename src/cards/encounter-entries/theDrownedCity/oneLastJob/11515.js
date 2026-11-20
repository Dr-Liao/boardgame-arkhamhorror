// 11515 卷入交火 · 诡计 ×2（金盆洗手）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：显现 - 将卷入交火放置入场，位于你的威胁区。
//       强制 - 你所在地点一名[[罪犯]]敌人被造成伤害时：检定[intellect]或[agility](3)。
//       如果你失败，将对该敌人造成的伤害减 1，并受到 1 点直接伤害。弃掉卷入交火。
// 印刷：特性 [[Hazard]]；无涌动/险境。
// 读点（引擎既有窗口，无需新原语）：
//   · 显现 = encounterResolve → api.threat(seat, '11515')（威胁区唯一写入口）；
//   · 「敌人受到伤害时」= 引擎 enemyDamaged 强制窗口（enemies.js#damageEnemy 在伤害写入后、
//     击败判定 **之前** 派发；combat.js 普通攻击路径同序）→ resolve 回写 damageTaken-1 可正确阻止击败；
//   · 技能检定 = api.choose 选智力/敏捷 + api.test（不能弹两次：只问一次技能）；
//   · 弃卡 = api.removeThreat。
const CODE = '11515'

function ownerOf(state, card) {
  return (state.investigators || []).find(inv => (inv.threat || []).includes(card)) || null
}

function enemyIsCriminal(enemy, helpers) {
  const traits = (enemy?.traits || []).length
    ? enemy.traits
    : (helpers?.cardTraits?.(enemy?.originalCode || enemy?.code) || [])
  return traits.some(trait => String(trait).toLowerCase() === 'criminal')
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    if (!inv) return false
    if (typeof api?.threat !== 'function') return false
    api.threat(inv.seat, CODE)
    api.info?.('「卷入交火」进入你的威胁区：罪犯敌人受伤时你将进行检定。')
    return { placed: true }
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDamaged',
    label: '卷入交火：所在地点的[[罪犯]]敌人受伤时检定智力/敏捷(3)，失败减 1 伤害并受 1 直接伤害，弃本卡',
    criteria: ({ state, source, context, helpers }) => {
      const owner = ownerOf(state, source)
      if (!owner) return false
      const enemy = context?.enemy
      if (!enemy || !state.enemies?.includes(enemy)) return false
      if (enemy.location !== owner.location) return false
      if (!enemyIsCriminal(enemy, helpers)) return false
      return (Number(context?.amount ?? context?.damage) || 0) > 0
    },
    resolve: ({ state, source, context, api }) => {
      const owner = ownerOf(state, source)
      const enemy = context?.enemy
      if (!owner || !enemy) return
      const skill = api.choose?.({
        kind: 'skill', source: CODE, seat: owner.seat,
        prompt: '卷入交火：选择本次检定使用的技能。',
        options: [{ id: 'intellect', label: '智力' }, { id: 'agility', label: '敏捷' }],
      }) || 'intellect'
      api.test(owner.seat, skill, 3, {
        source: { type: 'treachery', code: CODE },
        resolve: result => {
          if (result?.success) return
          if (state.enemies?.includes(enemy)) {
            const reduced = Math.max(0, (Number(enemy.damageTaken) || 0) - 1)
            // 只经 ctx.api 写状态（R1）：api.setEnemyDamageTaken 是敌人伤害值的唯一写入口。
            if (typeof api.setEnemyDamageTaken === 'function') api.setEnemyDamageTaken(enemy, reduced)
            else api.scenario?.setEnemyDamageTaken?.(enemy, reduced)
          }
          api.directDamage?.(owner.seat, 1)
          api.removeThreat?.(source)
          api.info?.(`💥 「卷入交火」：${owner.name} 检定失败，本次伤害 -1，受到 1 点直接伤害并弃掉本卡。`)
        },
      })
    },
  }],
  note: '印刷行为已接到引擎既有 enemyDamaged 强制窗口。'
    + '实现说明：不在 behavior.enemyDamageAmount（同步数值钩子）里嵌技能检定（同步钩子无法等待检定结果）；'
    + 'enemyDamaged 在伤害写入后、击败判定前派发，回写 damageTaken-1 与印刷的「伤害减 1」等价，'
    + '且失败时能阻止击败；伤害回写经 api.setEnemyDamageTaken（ctx.api，R1 合规）。'
    + '技能选择只弹一次（智力/敏捷二选一），随后 api.test 一次。',
}
