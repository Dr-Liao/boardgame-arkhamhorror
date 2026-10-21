// 03108 解剖图表
// 卡面：快速。在任意调查员的回合期间打出。仅当你剩余神智值为5点或以上才可打出。
// 卡面：选择你所在地点的一个非[[精英]]敌人。直到当前调查员的回合结束，该敌人得到-2攻击和-2躲避。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03108 解剖图：本回合该敌人的战斗与躲避 -2。

export default {
  code: '03108',
  abilities: [
    {
      kind: 'action', label: '解剖图：敌人战斗与躲避 -2', cost: { action: true, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
        if (!candidates.length) { api.info('这里没有可瞄准的非精英敌人。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'enemy', source: '03108', seat: inv.seat, prompt: '选择敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = candidates.find(item => item.id === chosen) || candidates[0]
        api.enemyTestModifier(enemy, { fight: -2, evade: -2 })
      },
    },
  ],
  modifiers: [

  ],
}
