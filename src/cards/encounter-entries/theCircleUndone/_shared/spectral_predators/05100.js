// 05100 冥府之雾
// 归属：战役共用 · theCircleUndone；遭遇组：spectral_predators
// 卡面：猎物 - 所在地点线索最多的调查员。冷漠。猎手。
// 卡面：冥府之雾所在地点获得：「闹鬼 - 冥府之雾攻击你。」
//
// 「所在地点线索最多的调查员」当前引擎 PREY_RANK 只能表达「线索最多的调查员」，
// 用 prey: 'mostClues' 近似（记入 status.json 的 approximations）。
// 闹鬼能力用 api.grantHaunted 授予敌人当前所在地点；移动/离场时先清掉旧授予再按新地点授予。

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

export default {
  code: '05100',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'mostClues' },
  enemyScript: {
    onSpawn(state, enemy, api) {
      if (enemy.location) grantAt(enemy, enemy.location, api)
    },
    onMoved(state, enemy, newLocationId, api) {
      api.clearHauntedGrants?.(grant => grant.ability?.id === grantId(enemy))
      if (newLocationId) grantAt(enemy, newLocationId, api)
    },
    onDefeated(state, enemy, api) {
      api.clearHauntedGrants?.(grant => grant.ability?.id === grantId(enemy))
      return false // 正常击败/弃掉
    },
  },
}
