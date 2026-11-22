import { skillModifier } from './_shared.js'

const code = '60508'

export default {
  code,
  modifiers: [skillModifier('willpower', 1)],
  abilities: [{
    kind: 'reaction',
    trigger: 'failedTestMargin',
    label: '此处的调查员将检定失败时：使其失败差值减少或增加 1',
    cost: { exhaust: true },
    criteria: ({ inv, context }) => context.location === inv.location,
    resolve: ({ api, inv, context }) => {
      const answer = api.choice({
        kind: 'effect',
        source: code,
        seat: inv.seat,
        prompt: '你要减少还是增加 1 点失败差值？',
        options: [
          { id: 'less', label: '减少 1 点失败差值' },
          { id: 'more', label: '增加 1 点失败差值' },
        ],
      })
      api.adjustFailedTestMargin(context, answer === 'less' ? -1 : 1)
    },
  }],
}
