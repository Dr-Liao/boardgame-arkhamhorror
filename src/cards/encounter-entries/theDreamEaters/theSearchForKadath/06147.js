// 06147 夜色怪群（theSearchForKadath）· 敌人（怪物 / 精英，庞大，蜂拥1[per_investigator]，胜利1）
// 卡面：庞大。蜂拥1[每名调查员]。
// 卡面：夜色怪群的蜂拥卡牌不能攻击。
// 卡面：夜色怪群的头领卡牌不能被击败。如果其将被击败，改为横置夜色怪群。
//
// 一卡一文件：行为只在这里维护。
// 「蜂拥卡不能攻击」由蜂拥实体本身不是敌人处理（共享层 swarm）；这里实现头领的替代击败。
export default {
  code: '06147', scope: 'enemy', implemented: true,
  enemyScript: {
    onDefeated(state, enemy, api) {
      api.exhaustEnemy?.(enemy)
      api.info?.('🌑 夜色怪群的头领不能被击败：改为横置。')
      // 返回 true = 接管这次击败（不进胜利区、不进弃牌堆）。
      return true
    },
  },
}
