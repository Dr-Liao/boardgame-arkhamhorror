// 04265 手铐
// 卡面：[action]如果手铐没有附属到敌人：躲避。只能对[[类人]]敌人使用。本次躲避尝试不使用[agility]，改为使用[combat]。如果你检定成功，将手铐附属到刚刚躲避的敌人。
// 卡面：如果附属的敌人非[[精英]]，其不能重整，也不能在其上放置毁灭标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04265 手铐：对同地点人形敌人做一次标准躲避尝试（战斗代替敏捷），成功则横置、脱离交战并铐住。
// 走 api.evade 才能拿到标准躲避语义：警戒（Alert）失败反击、evadeSuccess 反应窗口、afterEvade 钩子。

export default {
  code: '04265',
  abilities: [
    {
      kind: 'action', label: '躲向并铐住人形敌人', countsAs: 'evade', cost: { action: true },
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location
          && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid'))
        if (!targets.length) { api.info('这里没有可铐住的人形敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '04265',
          seat: inv.seat, prompt: '选择要铐住的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.evade(inv.seat, {
          enemyId: enemy.id, skill: 'combat', sourceCode: '04265',
          onSuccess: ({ inv: actor }) => {
            api.attachSelfTo('04265', enemy.id)
            api.info(`「${enemy.name}」被${actor?.name || '你'}的手铐铐住：不能重整，也不能放置毁灭。`)
          },
        })
      },
    },
  ],
  restrainsDoom: true,
  restrainsReady: true,
  modifiers: [

  ],
}
