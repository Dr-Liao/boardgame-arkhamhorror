import { keysHeldAtLocation } from '../../_shared.js'
// 达贡祭坛：钥匙要求由本地点调查员共同满足；线索费用也只由本地点共同支付。
export default {
  code: '07050', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '达贡祭坛：取得绿色钥匙',
    cost: { action: 1, groupClues: ({ state }) => 2 * state.investigators.length },
    criteria: [({ state, source }) => {
      const keys = keysHeldAtLocation(state, source.id)
      return state.scenarioFlags?.mechanics?.keys?.green?.holder === 'setAside'
        && (keys.includes('blue') || keys.length >= 3)
    }],
    resolve: ({ inv, api }) => api.keys.transfer('green', 'setAside', `investigator:${inv.seat}`, { reveal: true }),
  }],
}
