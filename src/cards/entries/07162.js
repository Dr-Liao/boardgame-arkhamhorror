export default { code: '07162', abilities: [{ kind: 'played', noOpportunityAttack: true,
  label: '揭示标记至指定符号，伤害敌人或治疗伤害',
  resolve: ({ state, inv, api }) => {
    const token = api.playerTools.inspectUntil(['curse', 'autofail', 'bless', 'eldersign']).at(-1)
    if (token === 'curse' || token === 'autofail') {
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({ kind: 'target', source: '07162', seat: inv.seat,
        prompt: '选择同地点的敌人，造成2伤害。', options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
      const enemy = enemies.find(enemy => enemy.id === id)
      if (enemy) api.damageEnemy(enemy, 2, inv.seat, '07162')
    } else if (token === 'bless' || token === 'eldersign') {
      const targets = state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
        .flatMap(owner => [
          ...((owner.damage || 0) > 0 ? [{ id: `investigator:${owner.seat}`, owner, label: owner.name }] : []),
          ...owner.assets.filter(asset => (asset.damage || 0) > 0
            && api.cardTraits(asset.code).some(trait => trait.toLowerCase() === 'ally'))
            .map(asset => ({ id: asset.id, owner, asset, label: api.cardName(asset.code) })),
        ])
      if (!targets.length) return
      const id = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '07162', seat: inv.seat,
        prompt: '选择同地点的调查员或盟友，治疗2伤害。', options: targets.map(target => ({ id: target.id, label: target.label })) })
      const target = targets.find(target => target.id === id)
      if (target?.asset) api.healAsset(target.asset, { damage: 2, ownerSeat: target.owner.seat })
      else if (target) api.healDamage(target.owner.seat, 2)
    }
  },
}] }
