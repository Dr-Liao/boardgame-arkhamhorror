export default {
  code: '11088',
  abilities: [{
    kind: 'commit',
    label: '可投入本地点或连接地点的调查或谈判检定；成功时，由检定者在其所在地发现 1 个线索',
    skill: {
      anySkill: true,
      commitFrom: 'connecting',
      commitCondition: ({ state, owner, performer, test }) => {
        const kind = test.actionKind || test.target?.actionKind || test.source?.actionKind
        if (!['investigate', 'parley'].includes(kind)) return false
        const locationId = test.target?.kind === 'location' ? test.target.id : performer.location
        return owner.location === locationId || Boolean(state.locations.find(location => location.id === owner.location)
          ?.connections?.includes(locationId))
      },
      onSuccessResolve: ({ test, api }) => { api.discoverClue(test.seat, 1) },
    },
  }],
}
