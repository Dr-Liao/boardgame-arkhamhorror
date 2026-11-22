// 60265 缓和局势（De-Escalate）
// 卡面：谈判。选择你所在地点的一个敌人。治愈等于该敌人恐惧值的恐惧。
// 读点：played countsAs parley + api.healHorror（按 api.cardDef 的 horror 值）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60265'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'parley',
    label: '谈判：选择敌人，治愈等于其恐惧值的恐惧',
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要谈判的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      const horror = Number(enemy.horror) || Number(api.cardDef?.(enemy.code)?.horror) || 0
      if (horror > 0) api.healHorror(inv.seat, horror)
    },
  }],
  modifiers: [],
}
