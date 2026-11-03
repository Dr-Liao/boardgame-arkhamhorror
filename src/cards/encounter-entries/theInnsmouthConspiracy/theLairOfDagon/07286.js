export default {
  code: '07286', scope: 'location',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费黑色钥匙：解锁三楼',
    additionalKeyCost: { colors: ['black'] },
    criteria: ({ state }) => !state.scenarioFlags?.remembered?.includes('UnlockedTheThirdFloor'),
    resolve: ({ api }) => api.scenario.remember('UnlockedTheThirdFloor'),
  }],
}
