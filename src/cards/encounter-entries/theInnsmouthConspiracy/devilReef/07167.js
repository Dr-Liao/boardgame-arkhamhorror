import { keysHeldByGroup } from '../../_shared.js'

export default {
  code: '07167',
  scope: 'act',
  actRule: {
    keyClaimBlockedTraits: ["Y'ha-nthlei"],
    objective(state) {
      const keys = keysHeldByGroup(state)
      return ['purple', 'white', 'black'].every(color => keys.includes(color))
    },
    onReveal: (state, act, api) => api.finish('resolution1'),
  },
}
