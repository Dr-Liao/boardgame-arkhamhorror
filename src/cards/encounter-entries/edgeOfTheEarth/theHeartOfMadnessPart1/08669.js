// 08669 原质团（Protoplasmic Mass）· 大封印组敌人
// 卡面：Hunter。Spawn - 外环离你最远的地点。Prey - 最近的持有封印的调查员。
// 强制 - 敌人阶段结束时，如果有调查员控制激活封印：原质团重整并再次结算敌人阶段（每阶段限一次）。
export default {
  code: '08669',
  scope: 'enemy',
  implemented: true,
  flags: {
    prey: 'nearestSealHolder',
    spawnFarthestOuterRing: true,
    enemyPhaseEndReadyIfActivatedSeal: true,
  },
  enemyScript: {
    onSpawn(state, enemy, api) {
      api.info?.('🫀 原质团生成：优先选择最近的持封印调查员。')
    },
  },
}
