import { ALL_CARDS } from '../cards-data.js'
import { currentEffectSource } from '../../engine/effect-provenance.js'
import { hasTrait } from '../../engine/matcher.js'

const code = '11103'

function isSpellEventTest(state, inv) {
  if (state.skillTest?.seat !== inv.seat) return false
  const event = ALL_CARDS[currentEffectSource(state)?.code]
  return event?.type === 'event' && hasTrait(event, 'Spell')
}

export default {
  code,
  modifiers: [{
    target: 'testValue', amount: 1,
    condition: { when: ({ state, inv }) => isSpellEventTest(state, inv) },
  }],
  abilities: [{
    kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'],
    duringOwnSkillTest: true,
    limit: { scope: 'perTest', owner: 'investigator' },
    label: '法术事件检定中：受到至多 3 恐惧，每点额外揭示 1 枚标记，只结算所选的一枚',
    criteria: ({ inv, state }) => isSpellEventTest(state, inv),
    resolve: ({ inv, api }) => {
      const amount = Number(api.choice({
        kind: 'amount', source: code, seat: inv.seat, prompt: '选择要受到的恐惧数量。',
        options: [1, 2, 3].map(value => ({ id: String(value), label: `${value} 恐惧` })),
      }))
      api.horror(inv.seat, amount)
      if (!inv.defeated) api.addExtraChaosChoices(amount, code)
    },
  }],
}
