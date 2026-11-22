// 60280 法老卷轴（研究完成·二）
// 卡面：研究完成。使用(4秘密)。[action] 受到 1 点恐惧并花费 1 或 2 秘密：攻击([intellect])。本次攻击 +3[intellect]。
// 成功时每花费 1 秘密，本次攻击伤害 +1。
// 读点：action 描述子 cost {action, horror, uses} + api.fight({skill:intellect, combatBonus, damageBonus})。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60280'

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [{
    kind: 'action',
    label: '受 1 恐惧并花 1-2 秘密：智识攻击 +3，成功时每秘密 +1 伤害',
    cost: { action: true, horror: 1, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const spendMore = api.choice({
        kind: 'choice', source: CODE, seat: inv.seat, canSkip: true,
        prompt: '是否额外花费 1 秘密（总共 2）？',
        options: [{ id: 'one', label: '只花费 1 秘密' }, { id: 'two', label: '花费 2 秘密' }],
      })
      const spent = spendMore === 'two' ? 2 : 1
      if (spent > 1) api.addUses(source, -1)
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要攻击的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.fight(inv.seat, enemy.id, {
        skill: 'intellect', sourceCode: CODE, combatBonus: 3, damageBonus: spent,
      })
    },
  }],
  modifiers: [],
}
