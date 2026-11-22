// 60266 阴险真相（Insidious Truths）
// 卡面：作为打出阴险真相的额外费用，你可以弃掉最多 2 张手牌。
// 攻击([combat])。每有 1 张卡牌以此方式弃掉，本次攻击 +2[combat]、伤害 +1。
// 读点：played countsAs fight + api.discardChosen（弃手牌唯一入口）+ api.fight({combatBonus,damageBonus})。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60266'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'fight',
    label: '弃至多 2 张手牌；攻击，每张弃牌 +2 战斗、+1 伤害',
    resolve: ({ state, inv, api }) => {
      let spent = 0
      const hand = [...(inv.hand || [])]
      if (hand.length) {
        const count = Math.min(2, hand.length)
        const answer = api.choice({
          kind: 'choice', source: CODE, seat: inv.seat,
          prompt: '弃掉几张手牌作为额外费用？',
          options: Array.from({ length: count + 1 }, (_, index) => ({
            id: String(index), label: index === 0 ? '不弃牌' : '弃掉 ' + index + ' 张手牌',
          })),
        })
        spent = Math.max(0, Math.min(count, Number(answer) || 0))
        if (spent > 0) api.discardChosen(inv.seat, spent, CODE)
      }
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要攻击的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.fight(inv.seat, enemy.id, {
        sourceCode: CODE, combatBonus: spent * 2, damageBonus: spent,
      })
    },
  }],
  modifiers: [],
}
