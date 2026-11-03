const parent = state => state.enemies.find(enemy => ['07330a', '07330b'].includes(enemy.originalCode || enemy.code)
  && !enemy.defeated && !enemy.removedFromGame)

export default {
  code: '07333', scope: 'enemy',
  enemyRule: { revelationSpawn: { farthestOfCodes: ['07328', '07320'] } },
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '达贡的子嗣交战后：在达贡上放置1个毁灭，或达贡攻击你',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => source.id === context.enemy?.id
      && inv.seat === context.seat && Boolean(parent(state)),
    resolve: ({ state, inv, api }) => {
      const dagon = parent(state)
      if (!dagon) return
      const cannotAttack = (dagon.originalCode || dagon.code) === '07330a' || api.scenario.cannotAttack(dagon)
      const choice = cannotAttack ? 'doom' : api.choice({ kind: 'effect', source: '07333', seat: inv.seat,
        prompt: '在达贡上放置1个毁灭，或达贡攻击你。',
        options: [{ id: 'doom', label: '在达贡上放置1个毁灭' }, { id: 'attack', label: '达贡攻击你' }],
      })
      if (choice === 'doom') api.scenario.doomOn(dagon, 1)
      else api.scenario.attack(dagon, inv)
    },
  }],
}
