// 60233 死灵之书
// 卡面：使用(6秘密)。每副牌库限制1张。
// 卡面：[fast]花费1秘密：本次技能检定你的技能值+2。
// 卡面：[fast]花费2秘密：抽取2张卡牌。
// 卡面：[fast]花费3秘密：发现任意地点的1个线索。
// 卡面：[fast]花费4秘密：对一名与你交战的敌人造成3点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60233',
  uses: 6,
  usesType: 'secrets',
  abilities: [{
    kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'],
    duringOwnSkillTest: true, cost: { uses: 1 },
    label: '花费 1 秘密：本次检定技能值 +2',
    resolve: ({ api }) => api.addPendingTestBonus(2),
  }, {
    kind: 'free', cost: { uses: 2 },
    label: '花费 2 秘密：抽 2 张牌',
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 2),
  }, {
    kind: 'free', cost: { uses: 3 },
    label: '花费 3 秘密：在任一地点发现 1 个线索',
    criteria: ({ state, inv, helpers }) => state.locations.some(location => helpers.canDiscoverClueAt(inv.seat, location.id)),
    resolve: ({ inv, state, api }) => {
      const locations = state.locations.filter(location => api.canDiscoverClueAt(inv.seat, location.id))
      if (!locations.length) return
      const id = locations.length === 1 ? locations[0].id : api.choice({
        kind: 'location', source: '60233', seat: inv.seat, prompt: '选择有线索的地点。',
        options: locations.map(location => ({ id: location.id, label: location.name })),
      })
      api.discoverClue(inv.seat, 1, id)
    },
  }, {
    kind: 'free', cost: { uses: 4 },
    label: '花费 4 秘密：对与你交战的一个敌人造成 3 点伤害',
    criteria: ({ state, inv, helpers }) => state.enemies.some(enemy => enemy.engagedSeat === inv.seat
      && helpers.canDamageEnemy(enemy, inv.seat, '60233')),
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
        && api.canDamageEnemy(enemy, inv.seat, '60233'))
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'enemy', source: '60233', seat: inv.seat, prompt: '选择要造成伤害的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(candidate => candidate.id === id)
      if (enemy) api.damageEnemy(enemy, 3, inv.seat, '60233')
    },
  }],
}
