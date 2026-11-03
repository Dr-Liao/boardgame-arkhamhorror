export default {
  code: '07262', modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [
    { kind: 'reaction', trigger: 'blessTokensWouldReturnToPool', label: '将即将移除的祝福改为封印在奈芙蒂斯上',
      limit: { scope: 'perWindow', owner: 'instance' }, criteria: ({ context }) => context.indexes?.length > 0,
      resolve: ({ source, api, context }) => api.playerTools.sealRevealed(source.id, context.indexes) },
    { kind: 'free', label: '横置：释放 3 祝福或返回供应堆造成 2 伤害', cost: { action: false, exhaust: true },
      criteria: ({ state, source }) => (state.chaos?.sealed || []).filter(item => item.source === source.id && item.token === 'bless').length >= 3,
      resolve: ({ state, inv, source, api }) => {
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
        const option = enemies.length ? api.choice({ kind: 'effect', source: source.id, seat: inv.seat, prompt: '选择如何处理 3 个封印的祝福。',
          options: [{ id: 'release', label: '释放回混乱袋' }, { id: 'damage', label: '返回供应堆，对一个敌人造成 2 伤害' }] }) : 'release'
        if (option === 'release') { api.chaosTokens.release(source.id, 'bless', 3); return }
        const id = enemies.length === 1 ? enemies[0].id : api.choice({ kind: 'enemy', source: source.id, seat: inv.seat,
          prompt: '选择受到 2 点伤害的敌人。', options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        if (api.chaosTokens.release(source.id, 'bless', 3, { toPool: true }) === 3) api.damageEnemy(enemies.find(enemy => enemy.id === id), 2, inv.seat)
      } },
  ],
}
