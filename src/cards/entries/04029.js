// 04029 拉莱耶迷雾
// 卡面：使用(4充能)。
// 卡面：[action]花费1充能：躲避。本次躲避尝试不使用[agility]，改为使用[willpower]。如果你检定成功，在躲避所选敌人后，你可以移动到一个连接地点。如果本次躲避尝试期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，从你手牌中选择并弃掉一张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04029 意志闪避（旧 lureEvade）

const code = "04029"
const uses = 4

export default {
  code: code,
  uses: uses,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', label: '意志闪避', cost: { action: true, uses: 1 }, countsAs: 'evade',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
          || (enemy.massive && enemy.location === inv.location))
        if (!targets.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: code, seat: inv.seat,
            prompt: '选择要躲避的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.evade(inv.seat, { enemyId: chosen, skill: 'willpower', moveAfterEvade: true })
      },
    },
  ],
  modifiers: [

  ],
}
