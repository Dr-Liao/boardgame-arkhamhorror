const code = '11116'

export default {
  code,
  abilities: [{
    kind: 'played', countsAs: 'parley', noOpportunityAttack: true,
    label: '谈判：同地点一位调查员可免费打出一位盟友，再忽略全部费用触发该盟友的行动或快速能力',
    resolve: ({ inv, api }) => {
      const investigators = api.investigatorsAt(inv.location).filter(other => api.canAffectInvestigator(other.seat))
      if (!investigators.length) return
      const chosen = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
        kind: 'investigator', source: code, seat: inv.seat, prompt: '选择要接受励志演讲的调查员。',
        options: investigators.map(other => ({ id: String(other.seat), label: other.name })),
      })
      const target = investigators.find(other => other.seat === Number(chosen))
      const allies = [...new Set(target.hand)].filter(card => api.cardType(card) === 'asset'
        && api.cardTraits(card).some(trait => trait.toLowerCase() === 'ally')
        && api.canPlayAssetAtNoCost(target.seat, card))
      if (!allies.length) return
      const selected = api.choice({
        kind: 'card', source: code, seat: target.seat, canSkip: true, prompt: '是否免费打出一位盟友？',
        options: [{ id: 'skip', label: '不打出' }, ...allies.map(card => ({ id: card, cardCode: card, label: api.cardName(card) }))],
      })
      if (selected === 'skip') return
      const ally = api.playAssetAtNoCost(target.seat, selected)
      if (!ally) return
      const abilities = api.cardAbilityOptions(target.seat, ally, { ignoreCosts: true })
      if (!abilities.length) return
      const ability = api.choice({
        kind: 'ability', source: ally.id, seat: target.seat, canSkip: true, prompt: '是否忽略费用触发该盟友的一项能力？',
        options: [{ id: 'skip', label: '不触发' }, ...abilities.map(({ index, label }) => ({ id: String(index), label }))],
      })
      if (ability !== 'skip') api.resolveCardAbility(target.seat, ally, { abilityIndex: Number(ability), ignoreCosts: true })
    },
  }],
}
