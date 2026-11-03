import { hasTrait } from '../../_shared.js'

const inAura = ({ state, source, entity }) => source.id !== entity.id
  && source.engagedSeat == null && hasTrait(entity, 'Deep One')
  && (source.location === entity.location
    || state.locations.find(location => location.id === source.location)?.connections?.includes(entity.location) === true)

export default {
  code: '07254', scope: 'enemy',
  modifiers: ['enemyFight', 'enemyEvade'].map(target => ({
    target, amount: 1, audience: 'enemies', condition: { when: inAura },
  })),
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '深潜者保姆交战后：抽取1张遭遇牌并使该牌失去涌动',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => source.id === context.enemy?.id && inv.seat === context.seat,
    resolve: ({ inv, api }) => api.scenario.drawEncounter(inv.seat, { suppressSurge: true }),
  }],
}
