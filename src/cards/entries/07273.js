export default { code: '07273', uses: 0, usesType: 'corruption', abilities: [
  { kind: 'reaction', trigger: 'treachery', label: '承受1伤害与1恐惧：取消显现并放1腐化',
    cost: { damage: 1, horror: 1 },
    criteria: ({ inv, context }) => context.seat === inv.seat && !context.weakness && !context.cancelled && !context.cannotCancel,
    resolve: ({ inv, source, context, api }) => {
      api.playerTools.cancelRevelation(context)
      api.addUses(source, 1)
      if (source.uses >= 3) api.playerTools.removeAssetFromGame(inv.seat, source.id)
    } },
  { kind: 'free', label: '抽取遭遇牌：治疗1伤害和1恐惧，或移除1腐化', cost: { drawEncounter: 1 },
    criteria: ({ inv, source }) => (inv.damage || 0) > 0 || (inv.horror || 0) > 0 || source.uses > 0,
    resolve: ({ inv, source, api }) => {
      if (inv.defeated || inv.resigned) return
      const options = []
      if (inv.damage > 0 || inv.horror > 0) options.push({ id: 'heal', label: '治疗1伤害和1恐惧' })
      if (inv.assets.includes(source) && source.uses > 0) options.push({ id: 'corruption', label: '移除1腐化' })
      if (!options.length) return
      const answer = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '07273', seat: inv.seat,
        prompt: '选择净化效果。', options })
      if (answer === 'heal') { api.healDamage(inv.seat, 1); api.healHorror(inv.seat, 1) }
      else if (answer === 'corruption') api.addUses(source, -1)
    } },
] }
