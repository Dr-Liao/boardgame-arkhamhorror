import { ALL_CARDS } from '../cards-data.js'

export default {
  code: '11018',
  abilities: [{
    kind: 'commit', label: '交换等量的手牌和暗置牌',
    skill: {
      afterTest: ({ inv, api }) => {
        const available = [...new Set(inv.hand.filter(code => !ALL_CARDS[code]?.subtype))]
        const beneath = [...new Set(api.commitOrigins.beneath(inv.seat, inv.code))]
        const cards = (choices, prompt) => api.choice({
          kind: 'card', source: '11018', seat: inv.seat, prompt,
          options: [{ id: 'skip', label: '结束交换' }, ...choices.map(id => ({ id, cardCode: id, label: api.cardName(id) }))],
        })
        const fromHand = [...inv.hand]
        const fromBeneath = api.commitOrigins.beneath(inv.seat, inv.code)
        while (available.length && beneath.length) {
          const down = cards(available, '选择一张手牌用于交换。')
          if (down === 'skip') break
          const up = cards(beneath, '选择一张暗置牌用于交换。')
          if (up === 'skip') break
          if (!api.commitOrigins.swap(inv.seat, inv.code, up, down)) break
          fromHand.splice(fromHand.indexOf(down), 1)
          fromBeneath.splice(fromBeneath.indexOf(up), 1)
          if (!fromHand.includes(down)) available.splice(available.indexOf(down), 1)
          if (!fromBeneath.includes(up)) beneath.splice(beneath.indexOf(up), 1)
        }
      },
    },
  }],
}
