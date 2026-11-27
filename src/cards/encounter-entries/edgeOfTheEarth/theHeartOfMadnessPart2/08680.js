// 08680 未封幻影：在最近未坍塌的迷雾高塔生成，就绪时护住高塔并在敌人阶段末接近一座。
import { towerState } from '../../_shared.js'

const code = '08680'
const standingTower = (state, location) => location.mistPylon && towerState(state, location.id)?.collapsed === false

function chooseNearestTower(state, from, seat, api) {
  const targets = api.mechanics.map.nearest(from, location => standingTower(state, location))
  if (!targets.length) return null
  return targets.length === 1 ? targets[0] : api.choice({ kind: 'location', source: code, seat,
    prompt: '选择最近的未坍塌迷雾高塔。', options: targets.map(id => ({ id, label: api.locName(id) })),
  })
}

export default {
  code, scope: 'enemy', implemented: true,
  enemyRule: {
    spawnLocation: (state, { location, seat }, api) => chooseNearestTower(state, location, seat, api) ?? location,
    protectsTowerWhileReady: true,
  },
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '若未封幻影已重整：朝最近未坍塌的迷雾高塔移动一次',
    criteria: ({ state, source }) => !source.exhausted
      && !state.locations.some(location => location.id === source.location && standingTower(state, location))
      && state.locations.some(location => standingTower(state, location)),
    resolve: ({ state, source, api }) => {
      const id = chooseNearestTower(state, source.location, state.campaign.leadSeat ?? 0, api.scenario)
      if (id) api.scenario.moveEnemyToward(source, id, { source: code })
    },
  }],
}
