export default {
  code: '51004',
  researchRequirement: 'identifiedStrangeSolution',
  uses: 3,
  usesType: 'supplies',
  abilities: [{
    kind: 'action',
    label: '让同地点调查员获得 2 资源并抽 1 张牌',
    cost: { action: true, exhaust: true, uses: 1 },
    target: { kind: 'investigator' },
    resolve: ({ target, api }) => {
      api.gainResources(target.entity.seat, 2)
      api.drawCardsLogged(target.entity.seat, 1)
    },
  }],
}
