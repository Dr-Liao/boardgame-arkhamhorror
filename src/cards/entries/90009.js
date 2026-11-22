export default {
  code: '90009',
  abilities: [{
    kind: 'played',
    fast: true,
    label: '阻止非精英敌人攻击，轮末可解除交战并移动',
    resolve: ({ inv, api }) => {
      api.preventNonEliteAttacks(inv.seat, { until: 'endOfRound' })
      api.addEffect({
        duration: 'endOfRound',
        sourceCode: '90009',
        controllerSeat: inv.seat,
        abilities: [{
          kind: 'reaction',
          trigger: 'roundEnds',
          label: '解除所有交战并移动至多两步',
          limit: 'oncePerRound',
          effect: {
            type: 'sequence',
            effects: [
              { type: 'disengageAll' },
              { type: 'moveTo', maxDistance: 2, optional: true, keepEngaged: true, source: '90009' },
            ],
          },
        }],
      })
    },
  }],
}
