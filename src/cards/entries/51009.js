const code = '51009'

const enemiesHere = (state, inv) => state.enemies.filter(enemy => enemy.location === inv.location
  && !enemy.defeated && !enemy.removedFromGame)

export default {
  code,
  abilities: [{
    kind: 'played', fast: true, trigger: 'attackFail',
    criteria: ({ state, inv, context, helpers }) => context.seat === inv.seat && context.failedBy <= 3
      && (enemiesHere(state, inv).length > 0 || (context.attackDamage > 0 && helpers?.concealedDamageTargets?.().length > 0)),
    label: '攻击失败差值不超过 3：让此地一名敌人承受攻击伤害，且不误伤队友',
    resolve: ({ state, inv, api }) => {
      const reaction = api.reactionContext()
      const context = reaction?.context || reaction
      const enemies = enemiesHere(state, inv)
      const miniCards = context.attackDamage > 0 ? api.concealedDamageTargets(inv.seat, inv.location) : []
      const options = [...enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        ...miniCards.map((card, index) => ({ id: card.id, label: `揭露隐匿迷你卡 ${index + 1}` }))]
      if (!options.length) return
      const id = options.length === 1 ? options[0].id : api.choice({
        kind: miniCards.length ? 'target' : 'enemy', source: code, seat: inv.seat,
        prompt: miniCards.length ? '选择承伤的敌人，或用伤害揭露一张隐匿迷你卡。' : '选择承受本次攻击伤害的敌人。',
        options,
      })
      if (miniCards.some(card => card.id === id)) {
        if (api.exposeConcealedInsteadOfDamage(inv.seat, inv.location, id)) api.setReactionFlag('redirected', true)
        return
      }
      const target = enemies.find(enemy => enemy.id === id)
      if (!target) return
      api.setReactionFlag('redirected', true)
      api.damageEnemy(target, context.attackDamage, inv.seat, code)
    },
  }],
}
