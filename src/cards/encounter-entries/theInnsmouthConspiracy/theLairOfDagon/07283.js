export default {
  code: '07283', scope: 'location',
  locationRule: { connectsToTrait: 'Cave' },
  abilities: [{
    kind: 'action', actionKind: 'resign', label: '撤退：离开达贡密教',
    resolve: ({ inv, api }) => api.resign(inv.seat),
  }, {
    kind: 'action', actionKind: 'activate', label: '本地点共同花费紫色钥匙和每人3个线索：解锁洞穴入口',
    cost: { groupClues: ({ state }) => 3 * state.numInvestigators },
    additionalKeyCost: { colors: ['purple'], scope: 'here' },
    criteria: ({ state }) => !state.scenarioFlags?.remembered?.includes('UnlockedTheEntranceToTheCaves'),
    resolve: ({ api }) => api.scenario.remember('UnlockedTheEntranceToTheCaves'),
  }],
}
