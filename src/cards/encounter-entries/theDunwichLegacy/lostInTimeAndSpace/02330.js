// 02330 伊斯寻星者
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：生成 - 另一个次元。
// 卡面：反击。
// 卡面：强制 - 在伊斯寻星者攻击一位弃牌堆有至少10张卡的调查员时：在伊斯寻星者上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02330', scope: 'enemy', enemySpawnRule: { spawnMode: 'original', spawnFrom: '02320' },
  enemyScript: {
    onAttackStarted(state, enemy, inv) {
      if (inv.discard.length > 10) enemy.doom = (enemy.doom || 0) + 1
    },
  },
}
