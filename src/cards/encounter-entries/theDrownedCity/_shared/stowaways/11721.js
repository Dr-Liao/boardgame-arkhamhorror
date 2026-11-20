// 11721 偷渡者工蜂（Stowaway Drone）· 敌人 · 共享遭遇组 stowaways（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/stowaways。
// 卡面（cards-data 11721）：
//   冷漠。巡逻(最近的另一名其上没有毁灭标记的敌人)。
//   强制 - 敌军阶段结束时：在本地点另一名非[[精英]]敌人上放置1个毁灭标记。然后，弃掉偷渡者工蜂。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；关键词「冷漠」= flags/章节 encounterDefinitions 解析；
//   · 「巡逻(最近的另一名没有毁灭标记的敌人)」= 条目 enemyRule.patrolTarget
//     （读点 turn.js#patrolMove → enemy-keyword-movement.js#resolvePatrol，形状由注册期
//     normalizePatrolTarget 校验：{ kind:'enemy', maxDoom:0 } 表示毁灭 ≤0 的另一名敌人）；
//   · 「敌军阶段结束时」= enemyPhaseEnds 窗口（turn.js#resolveEnemyPhase 的唯一派发点）；
//   · 放毁灭 = api.doomOn（唯一写点），弃掉自身 = api.discardEnemy（敌人离开场上但不进胜利区）。
//
// 近似：参考实现要求「另一名非精英敌人」存在能力才触发；引擎同样把这条要求写进 criteria，
//   没有合法目标时不触发、本卡留在场上（与参考一致）。
const CODE = '11721'

const othersAtLocation = (state, source) => (state?.enemies || []).filter(enemy =>
  enemy !== source && !enemy.defeated && !enemy.removedFromGame
  && enemy.location === source.location && !enemy.elite)

export default {
  code: CODE,
  name: '偷渡者工蜂',
  scope: 'enemy',
  implemented: true,
  enemyRule: { patrolTarget: { kind: 'enemy', maxDoom: 0 } },
  flags: {
    traits: ['Monster', 'Stowaway'],
    quantity: 3,
    fight: 2,
    evade: 2,
    health: 1,
    damage: 1,
    horror: 0,
    aloof: true,
    patrol: { kind: 'enemy', maxDoom: 0 },
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyPhaseEnds',
    silent: true,
    label: '敌军阶段结束时：在本地点另一名非精英敌人上放 1 毁灭，然后弃掉本敌人',
    criteria: ({ state, source }) => {
      if (!source?.id || !(state?.enemies || []).some(enemy => enemy.id === source.id)) return false
      return othersAtLocation(state, source).length > 0
    },
    resolve: ({ state, source, api }) => {
      const options = othersAtLocation(state, source)
      if (!options.length) return
      const answer = options.length === 1 ? options[0].id : api.choice({
        kind: 'enemy', source: CODE, seat: state.currentSeat,
        prompt: '选择要放置毁灭标记的另一名非精英敌人。',
        options: options.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
      })
      const chosen = options.find(enemy => enemy.id === String(answer)) || options[0]
      api.doomOn?.(chosen, 1)
      api.info?.(`🐝 「偷渡者工蜂」：在「${chosen.name}」上放置 1 个毁灭标记，然后弃掉自身。`)
      api.discardEnemy?.(source)
    },
  }],
  note: '关键词「冷漠」与巡逻目标都来自印刷文本/节点数据；巡逻走 enemyRule.patrolTarget（turn.js#patrolMove）；'
    + '敌军阶段结束时的放毁灭 + 弃自身走 enemyPhaseEnds + api.doomOn + api.discardEnemy。'
    + '没有其他非精英敌人时强制能力不触发（参考实现的 exists 限制同口径）。',
}
