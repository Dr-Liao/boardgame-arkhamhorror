// 03309 短管猎枪
// 卡面：使用(2子弹)。
// 卡面：打出短管猎枪不会触发趁乱攻击。
// 卡面：[action]花费1子弹：攻击。这次攻击中你+1[combat]并造成+1伤害。如果短管猎枪是本回合入场的，你本次攻击得到额外+1[combat]并造成额外+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03309 短管猎枪：攻击同地点的敌人；本回合入场的 +2/+2，否则 +1/+1。

export default {
  code: '03309',
  uses: 2,
  usesType: 'ammo',
  noOpportunityAttack: true,
  abilities: [
    {
      kind: 'action', label: '短管猎枪攻击', cost: { action: true, uses: 1 }, countsAs: 'fight',
      resolve: ({ state, inv, source, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'enemy', source: '03309', seat: inv.seat, prompt: '选择敌人目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const fresh = source?.enteredRound === state.round
        api.fight(inv.seat, enemy.id, { combatBonus: fresh ? 2 : 1, damageBonus: fresh ? 2 : 1 })
      },
    },
  ],
  modifiers: [

  ],
}
