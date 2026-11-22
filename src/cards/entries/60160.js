// 60160 “让它们唱起来”（Make 'em sing）
// 卡面：谈判。选择你所在地点的一个敌人并检定[combat](X)，X 为该敌人的剩余生命值。成功时自动躲避该敌人，并发现你所在地点 1 个线索。
// 读点：played 描述子 countsAs parley + api.test（动态难度=剩余生命值）+ api.autoEvadeEnemy + api.discoverClue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60160'

export default {
  code: CODE,
  playCondition: [({ state, inv }) => state.enemies.some(enemy => enemy.location === inv.location && !enemy.defeated)],
  abilities: [{
    kind: 'played',
    label: '谈判：以敌人剩余生命值为难度检定战斗，成功自动躲避并发现线索',
    countsAs: 'parley',
    resolve: ({ state, inv, api }) => {
      const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
      if (!candidates.length) return
      const id = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要谈判的敌人。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = candidates.find(item => item.id === id) || candidates[0]
      const health = Math.max(1, (Number(enemy.health) || 1) - (Number(enemy.damageTaken) || 0))
      api.test(inv.seat, 'combat', health, {
        source: { code: CODE, label: '让它们唱起来' },
        resolve: result => {
          if (!result.success) return
          api.autoEvadeEnemy(enemy)
          api.discoverClue(inv.seat, 1, inv.location)
        },
      })
    },
  }],
  modifiers: [],
}
