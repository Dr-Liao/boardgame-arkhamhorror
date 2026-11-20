const CODE = '11042'

export default {
  code: CODE,
  abilities: [{
    kind: 'commit',
    label: '弃牌堆里的每份同名牌令此牌获得智力与敏捷图标；检定结束后可将它们洗回牌库',
    skill: {
      iconBonus: ({ inv, skill, test }) => {
        const wanted = [].concat(skill)
        const count = ['intellect', 'agility'].reduce((total, icon) => total
          + (test?.iconWeights ? test.iconWeights[icon] || 0 : Number(wanted.includes(icon))), 0)
        return count * inv.discard.filter(code => code === CODE).length
      },
      afterTest: ({ inv, api }) => {
        const copies = inv.discard.filter(code => code === CODE)
        if (!copies.length) return
        const answer = api.choice({
          kind: 'card', source: CODE, seat: inv.seat, prompt: '是否将弃牌堆里的其他同名牌洗回牌库？',
          options: [{ id: 'skip', label: '留在弃牌堆' }, { id: 'shuffle', label: '洗回所有其他副本' }],
        })
        if (answer !== 'shuffle') return
        for (const code of copies) api.moveCard({ code, from: 'discard', to: 'deck' }, { seat: inv.seat })
        api.shuffleDeck(inv.seat)
      },
    },
  }],
}
