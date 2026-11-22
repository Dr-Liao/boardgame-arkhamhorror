export default {
  code: '51008',
  uses: 4,
  usesType: 'charges',
  abilities: [{
    kind: 'action', cost: { action: true, uses: 1 },
    target: { kind: 'investigator', query: ({ candidate }) => candidate.entity.horror > 0 },
    label: '治疗同地点调查员共 2 点恐惧，可分开治疗',
    resolve: ({ inv, target, api }) => {
      api.healHorror(target.entity.seat, 1)
      const candidates = api.investigatorsAt(inv.location)
        .filter(other => other.horror > 0 && api.canAffectInvestigator(other.seat))
      if (!candidates.length) return
      const selected = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
        kind: 'investigator', source: '51008', seat: inv.seat, prompt: '选择治疗第 2 点恐惧的调查员。',
        options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
      })
      api.healHorror(Number(selected), 1)
    },
  }],
}
