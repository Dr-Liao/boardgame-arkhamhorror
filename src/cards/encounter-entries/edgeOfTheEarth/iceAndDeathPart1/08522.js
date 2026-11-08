// 08522 星之恐怖（Terror of the Stars）· 敌人
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart1（theCrash 组）。
// 卡面：猎手。庞大。星之恐怖得到 +3[per_investigator] 生命值。
//       星之恐怖处于重整状态时，调查员不能在星之恐怖所在地点撤退，或发现星之恐怖所在地点的线索。
// 读点：
//   · 生命值 +3/调查员 → 章节 behavior.enemyStatModifier（Engine rules-state 读点）；
//   · 「不能发现线索」→ behavior.canDiscoverClues / investigationError（moves 读点）；
//   · 「不能撤退」→ actRule.resign 的 whileEnemyReady 限制，由 behavior.scenarioActions 判定。
export default {
  code: '08522',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    healthPerInvestigator: 3,
    hunter: true,
    massive: true,
    whileReady: {
      blocksCluesAtLocation: true,
      blocksResignAtLocation: true,
    },
  },
  enemyRule: {
    victory: 1,
  },
}
