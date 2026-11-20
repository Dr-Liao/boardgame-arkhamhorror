import { SKILL_NAMES_ZH } from './_shared.js'

const code = '11091'
const stationed = state => state.agendaAside?.some(card => (card.originalCode || card.code) === code)

export default {
  code,
  keepOnPlay: true,
  modifiers: Object.keys(SKILL_NAMES_ZH).map(skill => ({
    target: `skill:${skill}`, amount: 2, audience: 'all',
    condition: { when: ({ source }) => source.selectedSkill === skill },
  })),
  abilities: [{
    kind: 'played', fast: true, trigger: 'phaseBegins',
    label: '调查阶段开始后：放在议程牌库旁，选一项技能，每位调查员该技能 +2',
    criteria: ({ state }) => state.phase === 'investigation' && !stationed(state),
    resolve: ({ inv, api }) => {
      const skill = api.choice({
        kind: 'skill', source: code, seat: inv.seat, prompt: '选择好天气增强的技能。',
        options: Object.entries(SKILL_NAMES_ZH).map(([id, label]) => ({ id, label })),
      })
      api.putNextToAgenda(code, { ownerSeat: inv.seat, selectedSkill: skill })
    },
  }, {
    kind: 'forced', trigger: 'investigationPhaseStarting',
    label: '调查阶段开始时：弃掉议程牌库旁的本卡',
    criteria: ({ source, inv }) => source.ownerSeat === inv.seat,
    resolve: ({ source, inv, api }) => {
      const discarded = api.discardAgendaAside(source.id)
      if (discarded) api.putInDiscard(inv.seat, discarded)
    },
  }],
}
