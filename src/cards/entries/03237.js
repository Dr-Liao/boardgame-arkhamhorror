// 03237 中途伏击
// 卡面：选择你所在地点一个处于横置状态的非[[精英]]敌人并检定[agility](X)，其中X为该敌人的躲避值。如果你检定成功，击败该敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03237 伏击：敏捷检定对抗一名已横置的非精英敌人的躲避值；成功则击败它。

export default {
  code: '03237',
  abilities: [
    {
      kind: 'played', label: '伏击',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location
          && enemy.exhausted && !enemy.elite)
        if (!candidates.length) { api.info('这里没有已横置的非精英敌人。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03237', seat: inv.seat, prompt: '选择要伏击的敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = candidates.find(enemy => enemy.id === chosen) || candidates[0]
        api.test(inv.seat, 'agility', api.enemyEvade(target), {
          source: { label: '事件', name: api.cardName('03237'), code: '03237' },
          resolve: result => { if (result.success) api.defeatEnemy(target, inv.seat) },
        })
      },
    },
  ],
  modifiers: [

  ],
}
