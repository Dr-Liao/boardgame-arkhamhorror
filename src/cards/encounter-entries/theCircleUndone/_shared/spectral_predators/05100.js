// 05100 冥府之雾
// 归属：战役共用 · theCircleUndone；遭遇组：spectral_predators
// 卡面：猎物 - 所在地点线索最多的调查员。冷漠。猎手。
// 卡面：冥府之雾所在地点获得：「闹鬼 - 冥府之雾攻击你。」
//
// prey：引擎 PREY_RANK 的 mostClues 是按「调查员持有线索」排序，不等于卡面的「所在地点线索
// 最多」。内容层在生成/移动/敌方阶段开始时按地点线索重算 enemy.preySeat（引擎 preyTarget 优先
// 采用实例上的 preySeat，card-ops.js:79-83），从而修正猎物目标；并列时由队长选择。
// 闹鬼能力用 api.grantHaunted 授予敌人当前所在地点；移动/离场时先清掉自己的旧授予再按新地点授予。

import { activeInvestigators } from '../../../_shared.js'

const NETHER_MIST = '05100'
const grantId = enemy => `05100:${enemy.id}`
const ABILITY_TEXT = '闹鬼 - 冥府之雾攻击你。'

function grantAt(enemy, locationId, api) {
  api.grantHaunted?.({
    locationId,
    ability: {
      id: grantId(enemy),
      text: ABILITY_TEXT,
      effect: [{ kind: 'attack', target: 'code', code: NETHER_MIST }],
    },
  })
}

// 猎物：所在地点线索最多的调查员（地点并列→该地点的调查员并列→队长选择）。
export function refreshNetherMistPrey(state, enemy, api) {
  const investigators = activeInvestigators(state)
  if (!investigators.length) {
    api.setEnemyPreySeat?.(enemy, null)
    return null
  }
  const locations = (state.locations || []).filter(entry => investigators.some(inv => inv.location === entry.id))
  if (!locations.length) {
    api.setEnemyPreySeat?.(enemy, null)
    return null
  }
  const most = Math.max(...locations.map(entry => Number(entry.clues) || 0))
  const pools = locations.filter(entry => (Number(entry.clues) || 0) === most)
  const candidates = investigators.filter(inv => pools.some(entry => entry.id === inv.location))
  if (!candidates.length) {
    api.setEnemyPreySeat?.(enemy, null)
    return null
  }
  let chosen = candidates[0]
  if (candidates.length > 1) {
    const answer = api.choose?.({
      kind: 'prey', source: '05100', seat: state.campaign?.leadSeat ?? 0,
      prompt: '选择冥府之雾的猎物（所在地点线索最多的调查员）。',
      options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
    })
    chosen = candidates.find(inv => String(inv.seat) === String(answer)) || candidates[0]
  }
  api.setEnemyPreySeat?.(enemy, chosen.seat)
  return chosen
}

export default {
  code: '05100',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'mostClues' },
  enemyScript: {
    onSpawn(state, enemy, api) {
      if (enemy.location) grantAt(enemy, enemy.location, api)
      refreshNetherMistPrey(state, enemy, api)
    },
    // 引擎第三参是「移动前地点」；新地点用 enemy.location（引擎已更新）。
    onMoved(state, enemy, newLocationId, api, previousLocationId) {
      api.clearHauntedGrants?.(grant => grant.ability?.id === grantId(enemy))
      const destination = newLocationId || enemy.location
      if (destination) grantAt(enemy, destination, api)
      refreshNetherMistPrey(state, enemy, api)
      return previousLocationId
    },
    // 敌方阶段开始刷新猎物：地点线索会随调查变化，猎物按当前线索最多者。
    onEnemyPhaseStart(state, enemy, api) {
      refreshNetherMistPrey(state, enemy, api)
    },
    onDefeated(state, enemy, api) {
      api.clearHauntedGrants?.(grant => grant.ability?.id === grantId(enemy))
      return false // 正常击败/弃掉
    },
  },
}
