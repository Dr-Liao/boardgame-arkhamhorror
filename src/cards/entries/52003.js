import { investigatorClues } from '../../engine/matcher.js'

const code = '52003'

export default {
  code,
  playCondition: [{ when: investigatorClues(1), message: '需要至少 1 个线索' }],
  abilities: [{
    kind: 'played',
    label: '按持有的线索选择治疗恐惧或弃置恐怖牌',
    resolve: ({ inv, api }) => {
      const repetitions = Math.min(3, inv.clues)
      for (let count = 0; count < repetitions; count++) {
        const people = api.investigatorsAt(inv.location)
          .filter(person => person.horror > 0)
        const terrors = api.cardsInPlayTreacheries().filter(entry => {
          if (!api.cardTraits(entry.code).some(trait => trait.toLowerCase() === 'terror')) return false
          return entry.hostType === 'location' ? entry.hostId === inv.location
            : ['investigator', 'enemy'].includes(entry.hostType) && entry.host.location === inv.location
        })
        const options = [
          ...people.map(person => ({ id: 'heal:' + person.seat, label: '治疗 ' + person.name + ' 的 2 点恐惧' })),
          ...terrors.map((entry, index) => ({
            id: 'discard:' + index, cardCode: entry.code, label: '弃置 ' + api.cardName(entry.code),
          })),
        ]
        if (!options.length) break
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: '选择本次治疗或弃置的目标。', options,
        })
        const [effect, index] = answer.split(':')
        if (effect === 'heal') api.healHorror(Number(index), 2)
        else {
          const entry = terrors[Number(index)]
          if (entry.hostType === 'investigator') api.removeThreat(entry.attachment)
          else api.discardCardInPlay(entry)
        }
      }
    },
  }],
}
