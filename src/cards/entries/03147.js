// 03147 双刃短刀
// 卡面：你执行的交战行动不会触发趁乱攻击。
// 卡面：[action]：攻击。你本次攻击得到+X[combat]。X为与你交战的敌人数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03147 双刃短刀：攻击同地点的敌人，战斗值 + 已交战敌人数。

export default {
  code: '03147',
  engageNoOpportunityAttack: true,
  abilities: [
    {
      kind: 'action', label: '双刃短刀攻击', cost: { action: true }, countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'enemy', source: '03147', seat: inv.seat, prompt: '选择敌人目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const engaged = state.enemies.filter(item => item.engagedSeat === inv.seat).length
        api.fight(inv.seat, enemy.id, { combatBonus: engaged })
      },
    },
  ],
  modifiers: [

  ],
}
