const parent = state => state.enemies.find(enemy => ['07331a', '07331b'].includes(enemy.originalCode || enemy.code)
  && !enemy.defeated && !enemy.removedFromGame)

export default {
  code: '07334', scope: 'enemy',
  enemyRule: { revelationSpawn: { farthestOfCodes: ['07329', '07320'] } },
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '海德拉的子嗣交战后：在海德拉上放置1个毁灭，或海德拉攻击你',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => source.id === context.enemy?.id
      && inv.seat === context.seat && Boolean(parent(state)),
    resolve: ({ state, inv, api }) => {
      const hydra = parent(state)
      if (!hydra) return
      const cannotAttack = (hydra.originalCode || hydra.code) === '07331a' || api.scenario.cannotAttack(hydra)
      const choice = cannotAttack ? 'doom' : api.choice({ kind: 'effect', source: '07334', seat: inv.seat,
        prompt: '在海德拉上放置1个毁灭，或海德拉攻击你。',
        options: [{ id: 'doom', label: '在海德拉上放置1个毁灭' }, { id: 'attack', label: '海德拉攻击你' }],
      })
      if (choice === 'doom') api.scenario.doomOn(hydra, 1)
      else api.scenario.attack(hydra, inv)
    },
  }],
}
