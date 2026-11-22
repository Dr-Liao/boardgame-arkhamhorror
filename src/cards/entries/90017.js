const code = '90017'

export default {
  code,
  kind: 'investigator',
  investigator: {
    playDamageDiscount: { trait: 'Spell', damage: 1, discount: 2, offerShuffle: true },
  },
  elderSign: {
    resolve: ({ inv, api }) => {
      if (inv.damage > 0 && api.choice({ kind: 'effect', source: code, seat: inv.seat, canSkip: true,
        prompt: '治疗 1 点伤害？', options: [
          { id: 'heal', label: '治疗伤害' }, { id: 'skip', label: '跳过' },
        ] }) === 'heal') api.healDamage(inv.seat, 1)
      return { delta: 1 }
    },
  },
  abilities: [],
}
