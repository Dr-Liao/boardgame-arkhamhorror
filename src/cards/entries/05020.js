// 05020 拷问
// 卡面：谈判。选择你所在地点的一个[[类人]]敌人并检定[combat](3)。本次检定得到+X难度，
//       其中X为所选敌人的伤害值。如果你检定成功，发现你所在地点的1个线索和其他任意一个地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05020 拷问：谈判事件（不引发借机攻击）——选一个同地点类人敌人，做战斗检定，
// 难度 3 + 敌人伤害值；成功发现所在地点 1 个线索，再发现任意另一个地点 1 个线索。

export default {
  code: '05020',
  // 卡面「选择你所在地点的一个[[类人]]敌人」：没有合法目标时不能打出（引擎的打出条件读点）。
  playCondition: [{
    when: ({ state, inv }) => (state.enemies || []).some(enemy => !enemy.defeated
      && enemy.location === inv.location
      && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid')),
    message: '你所在地点没有[[类人]]敌人，不能打出「拷问」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '拷问',
      // 「谈判」行动不引发借机攻击（与 P2.7 的谈判原语同一口径，事件卡写在 played 描述子上）。
      noOpportunityAttack: true,
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location
          && !enemy.defeated
          && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid'))
        if (!targets.length) { api.info('这里没有可以拷问的类人敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '05020', seat: inv.seat, prompt: '选择要拷问的类人敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.test(inv.seat, 'combat', 3 + (enemy.damage || 0), {
          source: { label: '拷问', enemyId: enemy.id, name: enemy.name, code: '05020' },
          resolve: result => {
            if (!result.success) return
            const here = state.locations.find(location => location.id === inv.location)
            if (here && (here.clues || 0) > 0) api.discoverClue(inv.seat, 1)
            const others = state.locations.filter(location => location.id !== inv.location && (location.clues || 0) > 0)
            if (!others.length) return
            const picked = others.length === 1 ? others[0].id
              : api.choice({ kind: 'target', source: '05020', seat: inv.seat, prompt: '选择发现 1 个线索的其他地点。',
                options: others.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
            const target = others.find(location => location.id === picked)
            if (target) api.discoverClue(inv.seat, 1, target.id)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
