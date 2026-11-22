// 60262 镇定自若（Unflappable）
// 卡面：躲避([agility])。本次躲避 +2[agility]。若检定成功且你控制至少 2 个线索，治愈 1 点恐惧。
// 读点：played 描述子 countsAs evade + api.evade({addSkill? } 用 api.test 代替) + api.healHorror。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60262'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'evade',
    label: '躲避：敏捷 +2；成功且 2+ 线索时治愈 1 恐惧',
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
        || (enemy.location === inv.location && !enemy.massive))
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.evade(inv.seat, {
        enemyId: enemy.id, skill: 'agility', skillBonus: 2, sourceCode: CODE,
        onSuccess: () => {
          if ((Number(inv.clues) || 0) >= 2) api.healHorror(inv.seat, 1)
        },
      })
    },
  }],
  modifiers: [],
}
