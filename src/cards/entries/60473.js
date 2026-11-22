// 60473 报应（Retribution，Marie Lambeau，2 XP）
// 卡面：快速。在一个敌人攻击你所在地点的调查员时打出。
//       你承受本次攻击的全部伤害和恐惧。每承受 1 点伤害/恐惧，对你所在地点的一个敌人造成 1 点伤害。
//
// 引擎读点：
//   · 打出时机 = `enemyAttack` interrupt 窗口（windows.js: interrupt；enemies.js#enemyAttack
//     在分配伤害前打开），context.attack 带 plannedDamage/plannedHorror。
//   · 取消原攻击 = api.cancelEnemyAttack(context)；随后由打出者承受该攻击计划的伤害/恐惧 =
//     api.directDamage / api.directHorror（直接放置，不经伤害分配）。
//   · 「每承受 1 点对敌人造成 1 点伤害」= api.damageEnemy（目标选择走 api.choice，同地点敌人）。
//   · 保留近似：原攻击的其它后续效果（如攻击后能力/attacked 窗口的 source 归属）不会转移到
//     打出者身上；真正的「重定向攻击目标」原语未落地（见 primitive-requests/w5-60472-redirect-enemy-attack.json）。
const CODE = '60473'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'enemyAttack',
    label: '承受本次攻击的伤害/恐惧；每点对同地点一个敌人造成 1 点伤害',
    criteria: [({ state, inv, context }) => {
      const enemy = context?.enemy || context?.attack?.enemy
      if (!enemy) return false
      if (enemy.location !== inv.location) return false
      const target = context?.seat != null ? state.investigators[context.seat] : null
      return !target || target.location === inv.location
    }],
    resolve: ({ state, inv, context, api }) => {
      const attack = context?.attack
      if (!attack) return
      const damage = Math.max(0, Number(attack.plannedDamage) || 0)
      const horror = Math.max(0, Number(attack.plannedHorror) || 0)
      if (!api.cancelEnemyAttack(context)) return
      if (damage) api.directDamage(inv.seat, damage)
      if (horror) api.directHorror(inv.seat, horror)
      api.info(`⛓️「报应」：${inv.name} 承受本次攻击的 ${damage} 点伤害与 ${horror} 点恐惧。`)
      const total = damage + horror
      if (!total) return
      const enemies = (state.enemies || []).filter(item => item.location === inv.location)
      if (!enemies.length) return
      const chosen = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat,
        prompt: `选择要承受 ${total} 点伤害的敌人。`,
        options: enemies.map(item => ({ id: item.id, label: item.name })),
      })
      const enemy = enemies.find(item => item.id === chosen) || enemies[0]
      if (!enemy) return
      api.damageEnemy(enemy, total, inv.seat, CODE)
      api.info(`⛓️「报应」：对「${enemy.name}」造成 ${total} 点伤害。`)
    },
  }],
}
