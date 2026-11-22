import { entryFlag } from './_shared.js'

export default {
  code: '60506',
  uses: 4,
  usesType: 'secrets',
  abilities: [{
    kind: 'reaction',
    trigger: 'skillTestFail',
    label: '此处的调查员检定失败至少 2 点后：横置并花费 1 秘密，为该调查员治疗 1 点恐惧',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv, context }) => {
      const tester = state.investigators[state.skillTest?.seat]
      return context.failedBy >= 2 && tester?.location === inv.location
        && !tester.formHealingProhibited
        && (tester.horror > 0 || tester.threat.some(card => card.counters > 0 && entryFlag(card.code, 'threatHorrorSink')))
    },
    resolve: ({ state, api }) => api.healHorror(state.skillTest.seat, 1),
  }],
}
