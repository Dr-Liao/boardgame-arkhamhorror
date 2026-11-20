export default {
  code: '11112',
  limitPerInvestigator: true,
  passive: { assignHarmAtLocation: true },
  abilities: [{
    kind: 'reaction', trigger: 'turnBegins',
    limit: { scope: 'perTurn', owner: 'instance' },
    label: '你的回合开始时：治疗本卡的 1 点伤害或恐惧',
    criteria: ({ inv, source, context }) => inv.seat === context.seat && (source.damage > 0 || source.horror > 0),
    resolve: ({ inv, source, api }) => {
      const options = []
      if (source.damage > 0) options.push({ id: 'damage', label: '治疗 1 点伤害' })
      if (source.horror > 0) options.push({ id: 'horror', label: '治疗 1 点恐惧' })
      const kind = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: '11112', seat: inv.seat, prompt: '选择可靠支援要治疗的类型。', options,
      })
      api.healAsset(source, { ownerSeat: inv.seat, [kind]: 1 })
    },
  }],
}
