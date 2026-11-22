// 60274 催眠术（Hypnotize，2 级）
// 卡面：谈判([intellect])。本次谈判 +2[intellect]。选择你所在地点一个非[[精英]]敌人。
// 本次检定难度等于该敌人剩余生命值。成功时把该敌人混洗入遭遇牌库。
// 读点：played countsAs parley + api.test（动态难度）+ api.shuffleEnemyIntoEncounterDeck（api-enemy 唯一写点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60274'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'parley',
    label: '谈判：以非精英敌人剩余生命值为难度，成功后洗回遭遇牌库',
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated
        && !enemy.elite)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要催眠的非精英敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.test(inv.seat, 'intellect', Math.max(1, (Number(enemy.health) || 1) - (Number(enemy.damageTaken) || 0)), {
        source: { code: CODE, label: '催眠术' },
        skillBonus: 2,
        resolve: result => {
          if (!result.success) return
          api.shuffleEnemyIntoEncounterDeck(enemy)
        },
      })
    },
  }],
  modifiers: [],
}
