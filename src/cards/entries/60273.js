// 60273 腐蚀反应（Caustic Reaction，2 级）
// 卡面：攻击([intellect])。本次攻击 +2[intellect]、伤害 +1。若检定成功且你控制至少 2 个线索，改为伤害 +2。
// 读点：played countsAs fight + api.fight({skill:intellect, combatBonus, damageBonus})。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60273'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'fight',
    label: '攻击：智识 +2、伤害 +1；成功且 2+ 线索时伤害 +2',
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
        skill: 'intellect', sourceCode: CODE, combatBonus: 2, damageBonus: 1,
        onSuccess: ({ opts }) => {
          if ((Number(inv.clues) || 0) >= 2) opts.damageBonus = (opts.damageBonus || 1) + 1
        },
      })
    },
  }],
  modifiers: [],
}
