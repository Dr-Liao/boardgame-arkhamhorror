// 08672 无名者 · 议程 5。毁灭放置可被一份新的无名疯狂替换。
import { entryDistance } from '../../_shared.js'
import { collapsedTowers } from '../../_shared.js'

const CODE = '08672'
const NAMELESS = '08679'

const isNameless = enemy => (enemy.originalCode || enemy.code) === NAMELESS
  && !enemy.defeated && !enemy.removedFromGame

export default {
  code: CODE, scope: 'agenda', implemented: true,
  agendaRule: {
    backEffect: 'rampSequence',
    objective: { type: 'namelessInPlay' },
    doomPlacementReplacement(state, amount, api) {
      if (!state.scenarioZones?.setAside?.includes(NAMELESS)) return false
      const occupied = new Set(state.enemies.filter(isNameless).map(enemy => enemy.location))
      const minds = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const available = state.locations.filter(location => !occupied.has(location.id)
        && location.connections?.some(id => occupied.has(id)) && api.canEnemyEnterLocation(NAMELESS, location.id))
      const distance = location => Math.min(...minds.map(inv => entryDistance(state, location.id, inv.location)))
      const closest = Math.min(...available.map(distance))
      if (Number.isFinite(closest)) {
        const options = available.filter(location => distance(location) === closest)
        const id = options.length === 1 ? options[0].id : api.choice({
          kind: 'location', source: CODE, seat: state.campaign.leadSeat,
          prompt: '选择一个最近的、与无名疯狂所在地点连接的地点生成无名疯狂。',
          options: options.map(location => ({ id: location.id, label: location.name })),
        })
        if (id) api.spawnSetAsideEnemy(NAMELESS, id)
      }
      return true
    },
  },
  abilities: [{
    kind: 'forced', trigger: 'roundEnds',
    label: '轮末：如果 15 份无名疯狂在场且并非全部迷雾高塔已坍塌，推进议程',
    criteria: ({ state }) => state.enemies.filter(isNameless).length >= 15 && collapsedTowers(state).length < 5,
    resolve: ({ api }) => api.scenario.advanceAgenda(),
  }],
}
