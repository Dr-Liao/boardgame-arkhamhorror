// 60261 腐蚀反应（Caustic Reaction）
// 卡面：攻击([intellect])。本次攻击 +1[intellect]。若你控制至少 2 个线索，伤害 +1。
// 读点：played 描述子 countsAs fight + api.fight({skill:intellect, combatBonus, damageBonus})。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60261'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'fight',
    label: '攻击：智识 +1；控制至少 2 线索时伤害 +1',
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要攻击的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.fight(inv.seat, enemy.id, {
        skill: 'intellect', sourceCode: CODE, combatBonus: 1,
        damageBonus: (Number(inv.clues) || 0) >= 2 ? 1 : 0,
      })
    },
  }],
  modifiers: [],
}
