import { skillModifier } from './_shared.js'

export default {
  code: '60527',
  modifiers: [skillModifier('willpower', 1), skillModifier('intellect', 1)],
  abilities: [{
    kind: 'reaction',
    trigger: 'testWouldFail',
    label: '此处的调查员将要失败时横置：本次检定技能值 +1 或 -1',
    cost: { exhaust: true },
    criteria: ({ state, inv, context }) => state.investigators[context.seat]?.location === inv.location,
    resolve: ({ api, inv, context }) => {
      const answer = api.choice({
        kind: 'effect', source: '60527', seat: inv.seat,
        prompt: '选择本次检定的技能值修正。',
        options: [
          { id: 'more', label: '技能值 +1' },
          { id: 'less', label: '技能值 -1' },
        ],
      })
      api.setReactionFlag('testBonus', (context.testBonus || 0) + (answer === 'less' ? -1 : 1), context)
    },
  }],
}
